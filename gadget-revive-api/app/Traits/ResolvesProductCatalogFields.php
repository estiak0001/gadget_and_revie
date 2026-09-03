<?php

namespace App\Traits;

use App\Models\ProductBrand;
use App\Models\ProductCategory;
use Illuminate\Support\Str;

/**
 * Category/brand matching + description/specifications text parsing shared by every path that
 * turns "raw catalog text" (a spreadsheet row, a scraped product) into real Product fields.
 *
 * Originally lived only in ProductBulkImport — extracted verbatim (no behavior change) so the
 * scraped-products staging ingest (ScrapedProductController) can reuse the exact same rules
 * instead of a second, drifting copy. See ProductBulkImport's class docblock for the reasoning
 * behind each format (grouped Specifications, bullet/paragraph Description, category
 * path-or-leaf matching, brand match-or-create).
 */
trait ResolvesProductCatalogFields
{
    /** Category lookup cache, keyed by lowercased "Parent > Child" path and by lowercased leaf name. */
    private array $categoryByPath = [];

    private array $categoryByName = [];

    private function preloadCategories(): void
    {
        $categories = ProductCategory::with('parent.parent.parent')->get();

        foreach ($categories as $category) {
            $leaf = Str::lower(trim($category->name));
            // An ambiguous leaf name (two categories sharing it under different parents) is
            // marked null so a plain-name match later is refused rather than guessed at.
            $this->categoryByName[$leaf] = array_key_exists($leaf, $this->categoryByName)
                ? null
                : $category->id;

            $path = collect($category->getBreadcrumb())->pluck('name')->implode(' > ');
            $this->categoryByPath[Str::lower(trim($path))] = $category->id;
        }
    }

    private function findCategoryId(?string $value): ?int
    {
        if (empty($value)) {
            return null;
        }
        $key = Str::lower(trim($value));

        return $this->categoryByPath[$key] ?? $this->categoryByName[$key] ?? null;
    }

    private function findOrCreateBrandId(?string $value): ?int
    {
        $name = trim((string) $value);
        if ($name === '') {
            return null;
        }

        $existing = ProductBrand::whereRaw('LOWER(name) = ?', [Str::lower($name)])->first();
        if ($existing) {
            return $existing->id;
        }

        return ProductBrand::create([
            'name' => $name,
            'slug' => Str::slug($name),
            'is_active' => true,
        ])->id;
    }

    /**
     * Converts the plain multi-line "Description" text (the way it's naturally typed/pasted —
     * a paragraph, a blank line, then "•"/"-" bullet lines, another blank line, etc.) into the
     * HTML the description field is actually rendered as everywhere else (the product form's
     * RichTextEditor, and dangerouslySetInnerHTML on the admin product view and the storefront
     * product page). A bare "\n" collapses to a single space in HTML, so without this a nicely
     * laid-out description would render as one squashed line.
     */
    private function formatDescriptionHtml(?string $raw): ?string
    {
        if (empty($raw)) {
            return null;
        }

        $html = '';
        $inList = false;

        foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
            $line = trim($line);

            if ($line === '') {
                if ($inList) {
                    $html .= '</ul>';
                    $inList = false;
                }
                continue;
            }

            $stripped = preg_replace('/^[•\-*]\s*/u', '', $line);
            $hadBullet = $stripped !== $line;

            if ($hadBullet) {
                if (!$inList) {
                    $html .= '<ul>';
                    $inList = true;
                }
                $html .= '<li>' . e($stripped) . '</li>';
            } else {
                if ($inList) {
                    $html .= '</ul>';
                    $inList = false;
                }
                $html .= '<p>' . e($line) . '</p>';
            }
        }

        if ($inList) {
            $html .= '</ul>';
        }

        return $html !== '' ? $html : null;
    }

    /**
     * Parses the "Specifications" text into the flat key-value map Product.specifications
     * expects — the exact shape adminProductStore already builds from the product form's spec-
     * list UI. Understands the grouped format real spec sheets tend to use:
     *   Display Features:
     *     • Display Size: 22"
     *     • Panel Type: VA
     *   Connectivity:
     *     • HDMI: HDMI(v1.4) x 1
     * as well as plain "Key: Value" lines with no grouping/bullets at all. A spec found under a
     * group is prefixed "Group - Key" — two different groups both happening to have, say, an
     * "Others" line is common in real spec sheets, and without the prefix the second one would
     * silently overwrite the first in the flat map.
     */
    private function parseSpecifications(?string $raw): ?array
    {
        if (empty($raw)) {
            return null;
        }

        $specs = [];
        $currentGroup = null;

        foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $stripped = preg_replace('/^[•\-*]\s*/u', '', $line);
            $hadBullet = $stripped !== $line;

            if (!$hadBullet && preg_match('/^(.+):\s*$/u', $line, $m)) {
                // A bare "Label:" with nothing after it — a group header, not a spec itself.
                $currentGroup = trim($m[1]);
                continue;
            }

            if (!str_contains($stripped, ':')) {
                continue;
            }

            [$key, $value] = array_map('trim', explode(':', $stripped, 2));
            if ($key === '' || $value === '') {
                continue;
            }

            $label = $currentGroup ? "{$currentGroup} - {$key}" : $key;
            $specs[$label] = $value;
        }

        return !empty($specs) ? $specs : null;
    }
}
