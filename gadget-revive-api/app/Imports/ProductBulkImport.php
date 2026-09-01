<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\ProductBrand;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Parses the bulk-upload spreadsheet and creates products from it. Every product created here
 * is forced inactive (`is_active = false`) and tagged `source = 'bulk_import'` — nothing from a
 * spreadsheet ever goes straight to the storefront; an admin has to open each one and flip it
 * active first (the normal "Activate" toggle already used everywhere else in the product list).
 *
 * Rows are processed independently, not inside one transaction — a typo in row 8 shouldn't
 * throw away the 40 good rows around it. Each row's outcome (created or the reason it failed)
 * is collected and handed back to the controller for the on-screen summary.
 *
 * Implements WithMultipleSheets solely to restrict processing to the "Products" sheet — without
 * it, maatwebsite/excel runs this SAME import against every sheet in the uploaded workbook
 * (Reader::getWorksheets(): "each worksheet [gets] the same import class" when
 * WithMultipleSheets isn't implemented), so the Categories/Brands/Instructions reference sheets
 * were silently being parsed as product rows too — every one of their rows failing validation
 * and inflating the failure count, with row numbers colliding across sheets since each sheet
 * counts its own rows from 1. Only reproduced against a real multi-sheet template with enough
 * rows to notice; the earlier single-sheet CSV test files never touched this path at all.
 *
 * Images pasted directly into the "Image 1".."Image 7" cells (real embedded pictures, not
 * URLs) are extracted separately by ProductBulkImageExtractor before this class ever runs —
 * see $imagesByRow — since ToCollection/WithHeadingRow only ever reads cell text, never
 * floating drawings. Image 1 becomes the main image, 2-7 become the gallery, in column order;
 * a row with no Image cells filled in simply gets no image, same as before this existed. Every
 * image is stored exactly as extracted — never resized, cropped, or re-encoded.
 *
 * "Description" (plain multi-line text with •/- bullets) is reformatted into HTML — see
 * formatDescriptionHtml() — since that field is rendered as real HTML everywhere else in this
 * app. "Specifications" (optionally grouped, "Group:" header + indented "• Key: Value" lines,
 * or just plain "Key: Value" lines) is parsed into Product.specifications' flat map — see
 * parseSpecifications().
 */
class ProductBulkImport implements ToCollection, WithHeadingRow, WithMultipleSheets
{
    /**
     * Restricts the import to just the "Products" sheet — see the class docblock for why this
     * is required, not optional. A plain .csv upload has no sheets/worksheet concept at all
     * (Reader::getWorksheets() special-cases that before this interface is ever consulted), so
     * this has no effect there.
     */
    public function sheets(): array
    {
        return ['Products' => $this];
    }

    /** @var array<int, array{row:int, name:?string, status:string, message:?string}> */
    public array $results = [];

    public int $created = 0;

    public int $failed = 0;

    /** Rows skipped because they match an existing product (or another row in this same file) —
     *  kept separate from $failed so the admin sees "these already exist" as its own list rather
     *  than mixed in with genuine data errors (missing name, bad category, etc.). */
    public int $duplicates = 0;

    /** Category lookup cache, keyed by lowercased "Parent > Child" path and by lowercased leaf name. */
    private array $categoryByPath = [];

    private array $categoryByName = [];

    /** Every SKU seen so far in this file, to catch duplicates within the same upload. */
    private array $seenSkus = [];

    /** Every product name seen so far in this file — SKU is optional on the sheet, so name is
     *  often the only signal available to catch a duplicate at all. */
    private array $seenNames = [];

    public function __construct(
        private readonly User $admin,
        private readonly string $batch,
        /** @var array<int, array<int, array{binary: string, extension: string}>> */
        private readonly array $imagesByRow = [],
    ) {
        $this->preloadCategories();
    }

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
     * Saves this row's extracted images (if any) to the same disk folders adminProductStore
     * uses for a manually-uploaded product — slot 1 (main image) to `products`, slots 2-7
     * (gallery, in column order) to `products/gallery`. Leaves both empty (null / []) when the
     * row had no Image cells filled in, same as before this existed.
     *
     * @param array<int, array{binary: string, extension: string}> $slots
     * @return array{image: ?string, gallery: array<int, string>}
     */
    private function storeRowImages(array $slots): array
    {
        $image = null;
        $gallery = [];

        foreach ($slots as $slotNumber => $file) {
            $filename = Str::random(40) . '.' . $file['extension'];
            $folder = $slotNumber === 1 ? 'products' : 'products/gallery';
            Storage::disk('public')->put("{$folder}/{$filename}", $file['binary']);

            if ($slotNumber === 1) {
                $image = "{$folder}/{$filename}";
            } else {
                $gallery[] = "{$folder}/{$filename}";
            }
        }

        return ['image' => $image, 'gallery' => $gallery];
    }

    /**
     * Converts the plain multi-line "Description" text (the way it's naturally typed/pasted —
     * a paragraph, a blank line, then "•"/"-" bullet lines, another blank line, etc.) into the
     * HTML the description field is actually rendered as everywhere else (the product form's
     * RichTextEditor, and dangerouslySetInnerHTML on the admin product view and the storefront
     * product page). A bare "\n" collapses to a single space in HTML, so without this a nicely
     * laid-out bulk-upload description would render as one squashed line.
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
     * Parses the "Specifications" column into the flat key-value map Product.specifications
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

    private function toBool(mixed $value, bool $default): bool
    {
        if ($value === null || $value === '') {
            return $default;
        }
        $normalized = Str::lower(trim((string) $value));

        return in_array($normalized, ['yes', 'y', '1', 'true'], true)
            ? true
            : (in_array($normalized, ['no', 'n', '0', 'false'], true) ? false : $default);
    }

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            // WithHeadingRow's collection is 0-indexed starting after the heading row, which is
            // spreadsheet row 2 — report the same row number the admin sees when they open the file.
            $excelRow = $index + 2;

            $row = $row->map(fn ($v) => is_string($v) ? trim($v) : $v);

            // A fully blank row (common trailing/spacer rows in a spreadsheet) is silently skipped,
            // not reported as a failure.
            if ($row->filter(fn ($v) => $v !== null && $v !== '')->isEmpty()) {
                continue;
            }

            $name = $row->get('name');
            $categoryId = $this->findCategoryId($row->get('category'));

            $errors = [];
            if (empty($name)) {
                $errors[] = 'Name is required.';
            }
            if (empty($row->get('category'))) {
                $errors[] = 'Category is required.';
            } elseif ($categoryId === null) {
                $errors[] = "Category '{$row->get('category')}' was not found (or matches more than one category — use its full path, e.g. \"Mobiles > Cases\").";
            }
            if ($row->get('price') === null || $row->get('price') === '' || !is_numeric($row->get('price'))) {
                $errors[] = 'Price is required and must be a number.';
            }
            if ($row->get('discount_price') !== null && $row->get('discount_price') !== '' && !is_numeric($row->get('discount_price'))) {
                $errors[] = 'Discount Price must be a number.';
            }
            if ($row->get('stock_quantity') !== null && $row->get('stock_quantity') !== '' && !is_numeric($row->get('stock_quantity'))) {
                $errors[] = 'Stock Quantity must be a whole number.';
            }
            $warrantyUnit = $row->get('warranty_unit') ? Str::lower(trim($row->get('warranty_unit'))) : null;
            if ($warrantyUnit !== null && !in_array($warrantyUnit, ['day', 'week', 'month', 'year'], true)) {
                $errors[] = "Warranty Unit must be one of day, week, month, year (got '{$row->get('warranty_unit')}').";
            }

            // Duplicate detection is checked separately from the validation errors above, and
            // against both this same file (two rows sharing a name/SKU) and the existing catalog
            // (Product's default SoftDeletes scope already excludes trashed rows from ->exists()).
            // SKU is optional on the sheet, so name is often the only signal available at all.
            $duplicateReasons = [];

            $sku = $row->get('sku') ? trim($row->get('sku')) : null;
            if ($sku) {
                $skuKey = Str::lower($sku);
                if (isset($this->seenSkus[$skuKey])) {
                    $duplicateReasons[] = "SKU '{$sku}' is duplicated earlier in this file (row {$this->seenSkus[$skuKey]}).";
                } elseif (Product::where('sku', $sku)->exists()) {
                    $duplicateReasons[] = "SKU '{$sku}' already exists.";
                }
            }

            if (!empty($name)) {
                $nameKey = Str::lower(trim($name));
                if (isset($this->seenNames[$nameKey])) {
                    $duplicateReasons[] = "A product named '{$name}' is duplicated earlier in this file (row {$this->seenNames[$nameKey]}).";
                } elseif (Product::whereRaw('LOWER(name) = ?', [$nameKey])->exists()) {
                    $duplicateReasons[] = "A product named '{$name}' already exists.";
                }
            }

            // Registered as seen regardless of this row's outcome, so a later row is still caught
            // as "duplicated earlier in this file" even if this row itself failed for other reasons.
            if ($sku) {
                $this->seenSkus[Str::lower($sku)] = $excelRow;
            }
            if (!empty($name)) {
                $this->seenNames[Str::lower(trim($name))] = $excelRow;
            }

            if (!empty($duplicateReasons)) {
                $this->duplicates++;
                $this->results[] = [
                    'row' => $excelRow,
                    'name' => $name ?: null,
                    'status' => 'duplicate',
                    'message' => implode(' ', array_merge($duplicateReasons, $errors)),
                ];
                continue;
            }

            if (!empty($errors)) {
                $this->failed++;
                $this->results[] = [
                    'row' => $excelRow,
                    'name' => $name ?: null,
                    'status' => 'failed',
                    'message' => implode(' ', $errors),
                ];
                continue;
            }

            $brandId = $this->findOrCreateBrandId($row->get('brand'));
            $images = $this->storeRowImages($this->imagesByRow[$excelRow] ?? []);

            $product = Product::create([
                'category_id' => $categoryId,
                'brand_id' => $brandId,
                'sku' => $sku,
                'name' => $name,
                'image' => $images['image'],
                'gallery' => !empty($images['gallery']) ? $images['gallery'] : null,
                'name_bn' => $row->get('name_bengali') ?: null,
                'description' => $this->formatDescriptionHtml($row->get('description')),
                'short_description' => $row->get('short_description') ?: null,
                'specifications' => $this->parseSpecifications($row->get('specifications')),
                'price' => (float) $row->get('price'),
                'discount_price' => $row->get('discount_price') !== null && $row->get('discount_price') !== ''
                    ? (float) $row->get('discount_price') : null,
                'stock_qty' => $row->get('stock_quantity') !== null && $row->get('stock_quantity') !== ''
                    ? (int) $row->get('stock_quantity') : 0,
                'always_in_stock' => $this->toBool($row->get('always_in_stock'), true),
                'low_stock_threshold' => $row->get('low_stock_threshold') !== null && $row->get('low_stock_threshold') !== ''
                    ? (int) $row->get('low_stock_threshold') : 5,
                'current_cost' => $row->get('current_cost') !== null && $row->get('current_cost') !== ''
                    ? (float) $row->get('current_cost') : null,
                'unit' => $row->get('unit') ?: 'piece',
                'model' => $row->get('model') ?: null,
                'warranty_value' => $row->get('warranty_value') !== null && $row->get('warranty_value') !== ''
                    ? (int) $row->get('warranty_value') : null,
                'warranty_unit' => $warrantyUnit,
                'is_active' => false,
                'is_draft' => false,
                'is_featured' => $this->toBool($row->get('featured'), false),
                'sort_order' => 0,
                'source' => 'bulk_import',
                'bulk_upload_batch' => $this->batch,
                'created_by' => $this->admin->id,
            ]);

            $this->created++;
            $this->results[] = [
                'row' => $excelRow,
                'name' => $product->name,
                'status' => 'created',
                'message' => null,
            ];
        }
    }
}
