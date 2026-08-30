<?php

namespace App\Exports\ProductBulkUpload;

use App\Models\ProductCategory;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Reference-only sheet listing every real category as its full path — copy one of these values
 * exactly into the "Category" column on the Products sheet. Full paths are shown (not just the
 * leaf name) because two categories can share a name under different parents; the import matches
 * a plain leaf name only when it's unambiguous.
 */
class CategoriesSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize
{
    public function array(): array
    {
        $rows = [['Category Path (copy into the Products sheet)']];

        ProductCategory::orderBy('name')->get()->each(function (ProductCategory $category) use (&$rows) {
            $path = collect($category->getBreadcrumb())->pluck('name')->implode(' > ');
            $rows[] = [$path];
        });

        return $rows;
    }

    public function title(): string
    {
        return 'Categories';
    }

    public function styles(Worksheet $sheet)
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
