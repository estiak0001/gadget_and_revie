<?php

namespace App\Exports;

use App\Exports\ProductBulkUpload\BrandsSheet;
use App\Exports\ProductBulkUpload\CategoriesSheet;
use App\Exports\ProductBulkUpload\InstructionsSheet;
use App\Exports\ProductBulkUpload\ProductsSheet;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ProductBulkUploadTemplateExport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            new ProductsSheet(),
            new CategoriesSheet(),
            new BrandsSheet(),
            new InstructionsSheet(),
        ];
    }
}
