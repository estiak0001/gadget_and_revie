<?php

namespace App\Imports;

use App\Models\Product;
use App\Models\ProductBrand;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

/**
 * Parses the bulk-upload spreadsheet and creates products from it. Every product created here
 * is forced inactive (`is_active = false`) and tagged `source = 'bulk_import'` — nothing from a
 * spreadsheet ever goes straight to the storefront; an admin has to open each one and flip it
 * active first (the normal "Activate" toggle already used everywhere else in the product list).
 *
 * Rows are processed independently, not inside one transaction — a typo in row 8 shouldn't
 * throw away the 40 good rows around it. Each row's outcome (created or the reason it failed)
 * is collected and handed back to the controller for the on-screen summary.
 */
class ProductBulkImport implements ToCollection, WithHeadingRow
{
    /** @var array<int, array{row:int, name:?string, status:string, message:?string}> */
    public array $results = [];

    public int $created = 0;

    public int $failed = 0;

    /** Category lookup cache, keyed by lowercased "Parent > Child" path and by lowercased leaf name. */
    private array $categoryByPath = [];

    private array $categoryByName = [];

    /** Every SKU seen so far in this file, to catch duplicates within the same upload. */
    private array $seenSkus = [];

    public function __construct(
        private readonly User $admin,
        private readonly string $batch,
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

            $sku = $row->get('sku') ? trim($row->get('sku')) : null;
            if ($sku) {
                $skuKey = Str::lower($sku);
                if (isset($this->seenSkus[$skuKey])) {
                    $errors[] = "SKU '{$sku}' is duplicated earlier in this file (row {$this->seenSkus[$skuKey]}).";
                } elseif (Product::where('sku', $sku)->exists()) {
                    $errors[] = "SKU '{$sku}' already exists.";
                }
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

            if ($sku) {
                $this->seenSkus[Str::lower($sku)] = $excelRow;
            }

            $brandId = $this->findOrCreateBrandId($row->get('brand'));

            $product = Product::create([
                'category_id' => $categoryId,
                'brand_id' => $brandId,
                'sku' => $sku,
                'name' => $name,
                'name_bn' => $row->get('name_bengali') ?: null,
                'description' => $row->get('description') ?: null,
                'short_description' => $row->get('short_description') ?: null,
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
