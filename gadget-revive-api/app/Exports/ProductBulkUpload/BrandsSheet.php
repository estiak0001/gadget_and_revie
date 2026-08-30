<?php

namespace App\Exports\ProductBulkUpload;

use App\Models\ProductBrand;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Reference-only. Unlike Category, Brand doesn't have to be one of these — an unrecognized
 * brand name in the Products sheet is simply created automatically on import.
 */
class BrandsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize
{
    public function array(): array
    {
        $rows = [['Existing Brand (or type a new one on the Products sheet — it will be created)']];

        ProductBrand::orderBy('name')->pluck('name')->each(function (string $name) use (&$rows) {
            $rows[] = [$name];
        });

        return $rows;
    }

    public function title(): string
    {
        return 'Brands';
    }

    public function styles(Worksheet $sheet)
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
