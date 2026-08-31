<?php

namespace App\Http\Controllers\Api;

use App\Exports\ProductBulkUploadTemplateExport;
use App\Http\Controllers\Controller;
use App\Imports\ProductBulkImageExtractor;
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

        // A large catalog file with several photos per row (hundreds of rows, thousands of
        // embedded pictures) can legitimately take several minutes to parse — well past the
        // 30s default max_execution_time — since PhpSpreadsheet has to walk every drawing's
        // relationship/anchor data, twice (once here for images, once inside Excel::import()
        // for the row values). This is an admin-only, deliberately-triggered action, not
        // public traffic, so raising the limit for just this one request is the safe fix
        // rather than capping catalog size. (nginx's fastcgi_read_timeout for this vhost was
        // raised to match — see deployment.md.)
        set_time_limit(0);

        $admin = $request->user();
        $batch = 'BULK-' . now()->format('Ymd-His') . '-' . strtoupper(Str::random(4));

        // Real embedded pictures in the "Image 1".."Image 7" cells (not URLs) — extracted from
        // the raw file independently of Excel::import() below, which only ever reads cell text.
        $imagesByRow = ProductBulkImageExtractor::extract($request->file('file')->getRealPath());

        $import = new ProductBulkImport($admin, $batch, $imagesByRow);
        Excel::import($import, $request->file('file'));

        AuditLog::log(
            $admin,
            'bulk_import_products',
            'Product',
            null,
            null,
            ['batch' => $batch, 'created' => $import->created, 'duplicates' => $import->duplicates, 'failed' => $import->failed],
            "Bulk-uploaded {$import->created} product(s) via Excel (batch {$batch})" .
                ($import->duplicates > 0 ? ", {$import->duplicates} duplicate(s) skipped" : '') .
                ($import->failed > 0 ? ", {$import->failed} row(s) failed" : '')
        );

        $message = $import->created > 0
            ? "{$import->created} product(s) created as Inactive — review and activate them to make them live."
            : 'No products were created — see the row details below.';
        if ($import->duplicates > 0) {
            $message .= " {$import->duplicates} row(s) were skipped as duplicates of an existing product.";
        }

        return $this->success([
            'batch' => $batch,
            'created' => $import->created,
            'duplicates' => $import->duplicates,
            'failed' => $import->failed,
            'results' => $import->results,
        ], $message);
    }
}
