<?php

namespace App\Exports\ProductBulkUpload;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class InstructionsSheet implements FromArray, WithTitle, WithStyles, ShouldAutoSize
{
    public function array(): array
    {
        return [
            ['How to use this file'],
            ['1. Fill in the "Products" sheet — one product per row. Do not change the header row.'],
            ['2. "Category" must match a value from the "Categories" sheet exactly (copy/paste it). Required.'],
            ['3. "Brand" is optional — an unrecognized brand name is created automatically.'],
            ['4. "Always In Stock", "Featured": type Yes or No. Leave blank for the default (Always In Stock = Yes, Featured = No).'],
            ['5. "Warranty Unit": must be day, week, month, or year — leave both warranty columns blank if there is no warranty.'],
            ['6. "SKU": leave blank to auto-generate one. If you do enter one, it must be unique.'],
            ['7. "Image 1".."Image 7": paste or insert the actual picture directly into the cell (Insert > Pictures in Excel) — do NOT type a URL or file path, it will be ignored.'],
            ['   Image 1 becomes the product\'s main image, Image 2-7 become its gallery, in that order. Leave all of them empty to add photos later on the product\'s edit page instead.'],
            [''],
            ['What happens after you upload this file'],
            ['Every product created from this file is saved as Inactive and tagged "Bulk Upload" — none of them appear on the storefront yet.'],
            ['Open each one from the Products list, review/complete the details and photo, then switch it Active to make it live on the storefront.'],
        ];
    }

    public function title(): string
    {
        return 'Instructions';
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 13]],
            11 => ['font' => ['bold' => true]],
        ];
    }
}
