<?php

namespace App\Exports\ProductBulkUpload;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * The sheet an admin actually fills in and re-uploads. Column order here is exactly what
 * App\Imports\ProductBulkImport expects — its heading-row "slug" formatter turns each header
 * below into the snake_case key the import reads (e.g. "Stock Quantity" → stock_quantity).
 *
 * "Specifications" is free-form text — optionally grouped ("Display Features:" on its own
 * line, then indented "• Key: Value" lines under it) or just plain "Key: Value" lines with no
 * grouping at all — parsed into Product.specifications' flat key-value map by
 * App\Imports\ProductBulkImport::parseSpecifications().
 *
 * "Image 1".."Image 7" are for real pictures pasted/inserted directly into the cell (Image 1 =
 * main image, 2-7 = gallery, in order) — never a URL or file path — extracted separately by
 * App\Imports\ProductBulkImageExtractor since these columns otherwise carry no text value at all.
 */
class ProductsSheet implements FromArray, WithTitle, WithStyles, WithColumnWidths, ShouldAutoSize
{
    public function array(): array
    {
        return [
            [
                'Name', 'Name Bengali', 'SKU', 'Category', 'Brand', 'Price', 'Discount Price',
                'Stock Quantity', 'Always In Stock', 'Low Stock Threshold', 'Current Cost', 'Unit',
                'Short Description', 'Description', 'Model', 'Warranty Value', 'Warranty Unit', 'Featured',
                'Specifications',
                'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5', 'Image 6', 'Image 7',
            ],
            [
                'iPhone 11 Battery (Original)', 'আইফোন ১১ ব্যাটারি', '', 'Mobiles > Batteries', 'Apple',
                1500, 1350, 20, 'No', 5, 950, 'piece', 'Original quality replacement battery',
                "High quality OEM-grade replacement battery with 12 months warranty.\n\nHere's what stands out:\n• Long-lasting cell\n• Drop-in fit, no soldering",
                'A2111', 12, 'month', 'No',
                "Battery:\n  • Capacity: 3110 mAh\n  • Type: Li-ion\nCompatibility:\n  • Model: iPhone 11",
                '', '', '', '', '', '', '',
            ],
        ];
    }

    public function title(): string
    {
        return 'Products';
    }

    public function styles(Worksheet $sheet)
    {
        return [1 => ['font' => ['bold' => true]]];
    }

    /** Widens the 7 Image columns (T through Z) so there's room to actually see a pasted
     *  picture, since ShouldAutoSize alone would size them to fit the empty header text only. */
    public function columnWidths(): array
    {
        $widths = ['S' => 40];
        foreach (['T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as $column) {
            $widths[$column] = 18;
        }

        return $widths;
    }
}
