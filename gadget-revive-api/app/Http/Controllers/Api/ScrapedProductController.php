<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ScrapedProductResource;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\ScrapedProduct;
use App\Traits\ResolvesProductCatalogFields;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Staging area for products submitted by an external scraping script (startech_scrap.ipynb,
 * run on the user's own machine — this server is Cloudflare-challenge-blocked on all three
 * competitor sites, confirmed exhaustively, so the scraping itself never runs here).
 *
 * ingest() is the one endpoint the script actually calls, once per scraped product. Everything
 * else (index/show/update/promote/reject/bulkReject/destroy) backs the /scraped-products admin
 * review screen: an admin maps each row's category (never auto-matched — the same "refuse to
 * guess" rule ProductBulkImport already applies), edits anything needed, then either Promotes it
 * into a real Product (still Inactive by default, same as every other bulk/automated creation
 * path in this app) or Rejects it.
 */
class ScrapedProductController extends BaseController
{
    use ResolvesProductCatalogFields;

    public function __construct()
    {
        $this->preloadCategories();
    }

    /**
     * POST /admin/scraped-products/ingest — called by the scraping script once per product.
     * Category is left null on no match (unlike the Excel importer, which hard-fails the row) —
     * there's no admin present to fix a typo mid-script, so it's simply queued for manual mapping
     * during review instead of rejecting the whole submission.
     */
    public function ingest(Request $request): JsonResponse
    {
        $request->validate([
            'batch' => 'nullable|string|max:64',
            'source_site' => 'required|string|max:32',
            'source_url' => 'nullable|string|max:2048',
            'source_product_id' => 'nullable|string|max:191',
            'category_raw' => 'nullable|string|max:191',
            'brand_raw' => 'nullable|string|max:191',
            'sku' => 'nullable|string|max:191',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'stock_qty' => 'nullable|integer|min:0',
            'stock_status_raw' => 'nullable|string|max:100',
            'current_cost' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'short_description' => 'nullable|string|max:2000',
            // Raw plain text — same "Group:\n  • Key: Value" / plain "Key: Value" shape as the
            // bulk-upload Excel template's Specifications column, run through the same parser.
            'description' => 'nullable|string',
            'specifications' => 'nullable|string',
            'model' => 'nullable|string|max:255',
            'warranty_value' => 'nullable|integer|min:0',
            'warranty_unit' => 'nullable|in:day,week,month,year',
            'image' => 'nullable|file|mimes:jpeg,jpg,png,gif,webp|max:8192',
            'gallery' => 'nullable|array',
            'gallery.*' => 'file|mimes:jpeg,jpg,png,gif,webp|max:8192',
        ]);

        $data = $request->only([
            'batch', 'source_site', 'source_url', 'source_product_id',
            'category_raw', 'brand_raw', 'sku', 'name', 'name_bn',
            'price', 'discount_price', 'stock_qty', 'stock_status_raw', 'current_cost',
            'unit', 'short_description', 'model', 'warranty_value', 'warranty_unit',
        ]);

        $data['category_id'] = $this->findCategoryId($request->input('category_raw'));
        $data['brand_id'] = $this->findOrCreateBrandId($request->input('brand_raw'));
        $data['description'] = $this->formatDescriptionHtml($request->input('description'));
        $data['specifications'] = $this->parseSpecifications($request->input('specifications'));

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }
        if ($request->hasFile('gallery')) {
            $galleryPaths = [];
            foreach ($request->file('gallery') as $file) {
                $galleryPaths[] = $file->store('products/gallery', 'public');
            }
            $data['gallery'] = $galleryPaths;
        }

        $scraped = ScrapedProduct::create($data);

        return $this->created(['id' => $scraped->id], 'Scraped product staged');
    }

    public function index(Request $request): JsonResponse
    {
        $query = ScrapedProduct::with(['category', 'brand']);

        foreach (['status', 'source_site', 'batch', 'brand_id', 'category_id'] as $filter) {
            if ($request->has($filter)) {
                $query->where($filter, $request->get($filter));
            }
        }

        if ($request->has('q')) {
            $q = $request->get('q');
            $query->where(function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%")
                    ->orWhere('sku', 'like', "%{$q}%")
                    ->orWhere('category_raw', 'like', "%{$q}%")
                    ->orWhere('brand_raw', 'like', "%{$q}%");
            });
        }

        $query->orderBy($request->get('sort_by', 'created_at'), $request->get('sort_order', 'desc'));

        return $this->paginated($query->paginate($request->get('per_page', 20)));
    }

    public function stats(): JsonResponse
    {
        return $this->success([
            'pending' => ScrapedProduct::where('status', 'pending')->count(),
            'promoted' => ScrapedProduct::where('status', 'promoted')->count(),
            'rejected' => ScrapedProduct::where('status', 'rejected')->count(),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $scraped = ScrapedProduct::with(['category', 'brand', 'reviewer', 'promotedProduct'])->findOrFail($id);

        return $this->success(new ScrapedProductResource($scraped));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $scraped = ScrapedProduct::findOrFail($id);
        if ($scraped->status !== 'pending') {
            return $this->error('Only a pending row can be edited.', 422);
        }

        $request->validate([
            'category_id' => 'nullable|exists:product_categories,id',
            'brand_id' => 'nullable|exists:product_brands,id',
            'sku' => 'nullable|string|max:191',
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'price' => 'nullable|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'stock_qty' => 'nullable|integer|min:0',
            'current_cost' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'short_description' => 'nullable|string|max:2000',
            'description' => 'nullable|string',
            'specifications' => 'nullable|array',
            'model' => 'nullable|string|max:255',
            'warranty_value' => 'nullable|integer|min:0',
            'warranty_unit' => 'nullable|in:day,week,month,year',
        ]);

        $scraped->update($request->only([
            'category_id', 'brand_id', 'sku', 'name', 'name_bn', 'price', 'discount_price',
            'stock_qty', 'current_cost', 'unit', 'short_description', 'description',
            'specifications', 'model', 'warranty_value', 'warranty_unit',
        ]));

        return $this->success(new ScrapedProductResource($scraped->fresh(['category', 'brand'])), 'Saved');
    }

    /**
     * The one action that turns a staged row into a real, live-catalog Product. Images are
     * copied (never referenced in place) to fresh disk paths so a later hard-delete of this
     * staging row can never take a live product's image down with it.
     */
    public function promote(int $id): JsonResponse
    {
        $admin = request()->user();
        $scraped = ScrapedProduct::findOrFail($id);

        if (!$scraped->canPromote()) {
            return $this->error('This row needs a mapped category and a price greater than 0 before it can be promoted.', 422);
        }

        // Same soft-delete-aware duplicate guard ProductBulkImport applies against the live catalog.
        if ($scraped->sku && Product::where('sku', $scraped->sku)->exists()) {
            return $this->error("A product with SKU '{$scraped->sku}' already exists.", 422);
        }
        if (Product::whereRaw('LOWER(name) = ?', [Str::lower(trim($scraped->name))])->exists()) {
            return $this->error("A product named '{$scraped->name}' already exists.", 422);
        }

        $product = DB::transaction(function () use ($scraped, $admin) {
            $image = $this->copyToFreshPath($scraped->image, 'products');
            $gallery = collect($scraped->gallery ?? [])
                ->map(fn ($path) => $this->copyToFreshPath($path, 'products/gallery'))
                ->filter()
                ->values()
                ->all();

            $product = Product::create([
                'category_id' => $scraped->category_id,
                'brand_id' => $scraped->brand_id,
                'sku' => $scraped->sku,
                'name' => $scraped->name,
                'name_bn' => $scraped->name_bn,
                'image' => $image,
                'gallery' => !empty($gallery) ? $gallery : null,
                'description' => $scraped->description,
                'short_description' => $scraped->short_description,
                'specifications' => $scraped->specifications,
                'price' => (float) $scraped->price,
                'discount_price' => $scraped->discount_price !== null ? (float) $scraped->discount_price : null,
                'stock_qty' => $scraped->stock_qty ?? 0,
                'always_in_stock' => false,
                'current_cost' => $scraped->current_cost !== null ? (float) $scraped->current_cost : null,
                'unit' => $scraped->unit ?: 'piece',
                'model' => $scraped->model,
                'warranty_value' => $scraped->warranty_value,
                'warranty_unit' => $scraped->warranty_unit,
                'is_active' => false,
                'is_draft' => false,
                'source' => 'scraped',
                'bulk_upload_batch' => $scraped->batch,
                'created_by' => $admin->id,
            ]);

            $scraped->update([
                'status' => 'promoted',
                'promoted_product_id' => $product->id,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            return $product;
        });

        AuditLog::log($admin, 'create_product', 'Product', $product->id, null, $product->toArray(), "Promoted from scraped product #{$scraped->id}");

        return $this->success(new ScrapedProductResource($scraped->fresh(['category', 'brand', 'promotedProduct'])), 'Promoted to Products (created Inactive — activate it from the Products list when ready)');
    }

    /** Copies a file already on the public disk to a new random-named path in $folder; returns null if the source doesn't exist. */
    private function copyToFreshPath(?string $sourcePath, string $folder): ?string
    {
        if (!$sourcePath || !Storage::disk('public')->exists($sourcePath)) {
            return null;
        }

        $extension = pathinfo($sourcePath, PATHINFO_EXTENSION) ?: 'jpg';
        $newPath = "{$folder}/" . Str::random(40) . '.' . $extension;
        Storage::disk('public')->copy($sourcePath, $newPath);

        return $newPath;
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $scraped = ScrapedProduct::findOrFail($id);

        if (!$scraped->canReject()) {
            return $this->error('Only a pending row can be rejected.', 422);
        }

        $request->validate(['reason' => 'nullable|string|max:255']);

        $scraped->update([
            'status' => 'rejected',
            'reject_reason' => $request->get('reason'),
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);

        return $this->success(new ScrapedProductResource($scraped), 'Rejected');
    }

    public function bulkReject(Request $request): JsonResponse
    {
        $admin = $request->user();

        $request->validate([
            'ids' => 'required|array|min:1|max:200',
            'ids.*' => 'integer',
            'reason' => 'nullable|string|max:255',
        ]);

        $rows = ScrapedProduct::whereIn('id', $request->ids)->where('status', 'pending')->get();

        foreach ($rows as $row) {
            $row->update([
                'status' => 'rejected',
                'reject_reason' => $request->get('reason'),
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);
        }

        $rejected = $rows->count();
        $skipped = count($request->ids) - $rejected;

        return $this->success(['rejected' => $rejected, 'skipped' => $skipped], "{$rejected} rejected" . ($skipped > 0 ? ", {$skipped} skipped (not pending)" : ''));
    }

    public function destroy(int $id): JsonResponse
    {
        $scraped = ScrapedProduct::findOrFail($id);

        if ($scraped->status === 'promoted') {
            return $this->error('This row was already promoted — its Product stays in the catalog; delete it from the Products list instead if that\'s what you mean.', 422);
        }

        $scraped->delete();

        return $this->noContent('Deleted');
    }
}
