<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProductBulkUploadTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\ProductBulkImport;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class ProductBulkUploadController extends Controller
{
    use ApiResponse;

    /**
     * Downloadable sample spreadsheet — columns exactly match what import() expects, plus
     * reference sheets for the category/brand names an admin actually has to choose from.
     */
    public function template()
    {
        return Excel::download(new ProductBulkUploadTemplateExport(), 'product-bulk-upload-template.xlsx');
    }

    /**
     * Bulk-create products from an uploaded spreadsheet. Every created product is forced
     * inactive and tagged with a batch id so it can be found and reviewed afterward — see
     * App\Imports\ProductBulkImport for why.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240',
        ]);

        $admin = $request->user();
        $batch = 'BULK-' . now()->format('Ymd-His') . '-' . strtoupper(Str::random(4));

        $import = new ProductBulkImport($admin, $batch);
        Excel::import($import, $request->file('file'));

        AuditLog::log(
            $admin,
            'bulk_import_products',
            'Product',
            null,
            null,
            ['batch' => $batch, 'created' => $import->created, 'failed' => $import->failed],
            "Bulk-uploaded {$import->created} product(s) via Excel (batch {$batch})" .
                ($import->failed > 0 ? ", {$import->failed} row(s) failed" : '')
        );

        return $this->success([
            'batch' => $batch,
            'created' => $import->created,
            'failed' => $import->failed,
            'results' => $import->results,
        ], $import->created > 0
            ? "{$import->created} product(s) created as Inactive — review and activate them to make them live."
            : 'No products were created — see the row errors below.'
        );
    }
}
