<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ScrapedProductResource;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\ScrapedProduct;
use App\Models\User;
use App\Traits\ResolvesProductCatalogFields;
use Illuminate\Database\Eloquent\Builder;
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
     *
     * Two things are checked *before* ever creating a row (and before any image upload, so a
     * skipped submission never wastes a disk write): a missing price is skipped outright rather
     * than staged — it can never be promoted (see canPromote()) and would just sit here unusable
     * — and a match against something already known is looked up via findIngestMatch(). A
     * *strong* match (same source_site + source_product_id — the scraper's own stable id for
     * this exact item) is synced/updated in place rather than refused: a re-scrape of something
     * already staged updates that row, and a re-scrape of something already promoted updates the
     * live Product directly (see below). A *weak* match (sku or name alone, with no source id)
     * still only reports a duplicate and touches nothing — that signal is too fuzzy to safely
     * auto-overwrite. All outcomes return 200/201 with a `status` field (created|updated|
     * reactivated|synced_to_product|duplicate|skipped_no_price) rather than an error — none of
     * them are a submission *failure*, they're normal, expected outcomes at this scale.
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

        if ($request->input('price') === null || $request->input('price') === '') {
            return $this->success(['id' => null, 'status' => 'skipped_no_price'], 'Skipped — no price given');
        }

        $match = $this->findIngestMatch($request);

        if ($match && $match['type'] === 'weak') {
            return $this->success(
                ['id' => $match['id'], 'status' => 'duplicate', 'reason' => $match['reason']],
                'Duplicate — ' . $match['reason']
            );
        }

        $data = $request->only([
            'batch', 'source_site', 'source_url', 'source_product_id',
            'category_raw', 'brand_raw', 'sku', 'name', 'name_bn',
            'price', 'discount_price', 'stock_qty', 'stock_status_raw', 'current_cost',
            'unit', 'short_description', 'model', 'warranty_value', 'warranty_unit',
        ]);
        // ->only() silently omits a key the request never sent at all (the notebook strips any
        // None value before POSTing) -- normalized here so every downstream read of
        // category_raw/brand_raw below is a safe, always-present key rather than risking an
        // "Undefined array key" on a product with no parsed brand/category text.
        $data['category_raw'] = $request->input('category_raw');
        $data['brand_raw'] = $request->input('brand_raw');
        $data['description'] = $this->formatDescriptionHtml($request->input('description'));
        $data['specifications'] = $this->parseSpecifications($request->input('specifications'));

        if ($match && $match['type'] === 'strong') {
            return $this->syncStrongMatch($match['scraped'], $request, $data);
        }

        $data['category_id'] = $this->findCategoryId($data['category_raw']);
        $data['brand_id'] = $this->findOrCreateBrandId($data['brand_raw']);

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }
        if ($request->hasFile('gallery')) {
            $data['gallery'] = collect($request->file('gallery'))
                ->map(fn ($file) => $file->store('products/gallery', 'public'))
                ->all();
        }

        $data['last_ingest_action'] = 'created';
        $data['last_ingested_at'] = now();

        $scraped = ScrapedProduct::create($data);

        return $this->created(['id' => $scraped->id, 'status' => 'created'], 'Scraped product staged');
    }

    /**
     * Updates an already-staged (or already-promoted) row in place instead of creating a second
     * copy -- "sync by source code". `category_id` is preserved unless the incoming `category_raw`
     * text actually changed (or it was never resolved), matching this app's "never auto-guess a
     * category" rule elsewhere: an admin's manual correction on a still-pending row must survive
     * a re-scrape. A previously-Rejected row is reactivated to pending (a re-scrape means someone
     * cares about it again). A previously-Promoted row also pushes every scraped field onto the
     * live Product (except is_active/is_draft/source/created_by/source_* -- those are never
     * "scraped" data, see scrapedFieldsToProductPayload()).
     */
    private function syncStrongMatch(ScrapedProduct $scraped, Request $request, array $data): JsonResponse
    {
        $data['category_id'] = ($scraped->category_raw !== $data['category_raw'] || $scraped->category_id === null)
            ? $this->findCategoryId($data['category_raw'])
            : $scraped->category_id;
        $data['brand_id'] = $this->findOrCreateBrandId($data['brand_raw']);

        if ($request->hasFile('image')) {
            $this->deleteScrapedFile($scraped->image);
            $data['image'] = $request->file('image')->store('products', 'public');
        }
        if ($request->hasFile('gallery')) {
            foreach ((array) $scraped->gallery as $oldPath) {
                $this->deleteScrapedFile($oldPath);
            }
            $data['gallery'] = collect($request->file('gallery'))
                ->map(fn ($file) => $file->store('products/gallery', 'public'))
                ->all();
        }

        $wasRejected = $scraped->status === 'rejected';
        $wasPromoted = $scraped->status === 'promoted';

        if ($wasRejected) {
            $data['status'] = 'pending';
            $data['reject_reason'] = null;
        }

        $data['last_ingest_action'] = $wasPromoted ? 'synced_to_product' : ($wasRejected ? 'reactivated' : 'updated');
        $data['last_ingested_at'] = now();

        $scraped->update($data);

        if ($wasPromoted && $scraped->promoted_product_id) {
            $product = Product::find($scraped->promoted_product_id);
            if ($product) {
                $productPayload = $this->scrapedFieldsToProductPayload($scraped->fresh());

                if (array_key_exists('image', $data)) {
                    $this->deleteScrapedFile($product->image);
                    $productPayload['image'] = $this->copyToFreshPath($data['image'], 'products');
                }
                if (array_key_exists('gallery', $data)) {
                    foreach ((array) $product->gallery as $oldPath) {
                        $this->deleteScrapedFile($oldPath);
                    }
                    $productPayload['gallery'] = collect($data['gallery'])
                        ->map(fn ($path) => $this->copyToFreshPath($path, 'products/gallery'))
                        ->filter()->values()->all() ?: null;
                }

                $product->update($productPayload);
            }

            return $this->success(
                ['id' => $scraped->id, 'status' => 'synced_to_product', 'product_id' => $scraped->promoted_product_id],
                'Synced to the live product'
            );
        }

        return $this->success(
            ['id' => $scraped->id, 'status' => $wasRejected ? 'reactivated' : 'updated'],
            $wasRejected ? 'Reactivated for review' : 'Updated'
        );
    }

    /**
     * Checked before ever creating a row. A *strong* match (same source_site +
     * source_product_id/source_url -- the scraper's own stable id for this exact item, whatever
     * its current status) flows into syncStrongMatch() rather than a flat refusal. The weaker
     * signals (sku or name alone) stay refuse-and-report only -- see ingest()'s docblock for why.
     *
     * @return array{type: 'strong', scraped: ScrapedProduct}|array{type: 'weak', id: ?int, reason: string}|null
     */
    private function findIngestMatch(Request $request): ?array
    {
        $sourceSite = $request->input('source_site');
        $sourceProductId = $request->input('source_product_id');
        $sourceUrl = $request->input('source_url');
        $sku = $request->input('sku');
        $name = trim((string) $request->input('name'));

        if ($sourceProductId || $sourceUrl) {
            $existing = ScrapedProduct::where('source_site', $sourceSite)
                ->when($sourceProductId, fn ($q) => $q->where('source_product_id', $sourceProductId))
                ->when(!$sourceProductId && $sourceUrl, fn ($q) => $q->where('source_url', $sourceUrl))
                ->whereIn('status', ['pending', 'promoted', 'rejected'])
                ->first();
            if ($existing) {
                return ['type' => 'strong', 'scraped' => $existing];
            }
        }

        if ($sku) {
            $existingBySku = ScrapedProduct::where('sku', $sku)->whereIn('status', ['pending', 'promoted'])->first();
            if ($existingBySku) {
                return ['type' => 'weak', 'id' => $existingBySku->id, 'reason' => "SKU '{$sku}' already staged ({$existingBySku->status})"];
            }
            if (Product::where('sku', $sku)->exists()) {
                return ['type' => 'weak', 'id' => null, 'reason' => "SKU '{$sku}' already exists in the live catalog"];
            }
        }

        if ($name !== '') {
            $existingByName = ScrapedProduct::whereRaw('LOWER(name) = ?', [Str::lower($name)])
                ->whereIn('status', ['pending', 'promoted'])
                ->first();
            if ($existingByName) {
                return ['type' => 'weak', 'id' => $existingByName->id, 'reason' => "a product named '{$name}' is already staged ({$existingByName->status})"];
            }
            if (Product::whereRaw('LOWER(name) = ?', [Str::lower($name)])->exists()) {
                return ['type' => 'weak', 'id' => null, 'reason' => "a product named '{$name}' already exists in the live catalog"];
            }
        }

        return null;
    }

    /** Deletes a file on the public disk if it's actually set and exists -- a no-op otherwise. */
    private function deleteScrapedFile(?string $path): void
    {
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $query = $this->applyScrapedProductFilters(ScrapedProduct::with(['category', 'brand']), $request);
        $query->orderBy($request->get('sort_by', 'created_at'), $request->get('sort_order', 'desc'));

        return $this->paginated($query->paginate($request->get('per_page', 20)));
    }

    /**
     * Every filter index() supports, factored out so bulkPromote()'s "select all N matching"
     * mode applies exactly the same WHERE clauses the admin is currently looking at — not a
     * second, drifting copy (see AdminController::applyProductFilters() for the same pattern).
     */
    private function applyScrapedProductFilters(Builder $query, Request $request): Builder
    {
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

        return $query;
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

        $result = $this->promoteRow($scraped, $admin);
        if (!$result['ok']) {
            return $this->error($result['message'], 422);
        }

        return $this->success(new ScrapedProductResource($scraped->fresh(['category', 'brand', 'promotedProduct'])), 'Promoted to Products (created Inactive — activate it from the Products list when ready)');
    }

    /**
     * "Move to live" in bulk — either a specific set of ids, or (select_all) every pending row
     * matching the current category/brand/search filters, so "promote this whole brand" or
     * "promote everything" is one click instead of opening each row. Category/price gaps and
     * catalog duplicates are real, expected outcomes at this scale (not every row a scraper
     * submits is ready) — those rows are skipped and reported, not treated as a failed request.
     */
    public function bulkPromote(Request $request): JsonResponse
    {
        $admin = $request->user();

        if ($request->boolean('select_all')) {
            $query = $this->applyScrapedProductFilters(ScrapedProduct::query(), $request)->where('status', 'pending');

            $promoted = 0;
            $errors = [];
            $query->chunkById(100, function ($rows) use ($admin, &$promoted, &$errors) {
                foreach ($rows as $row) {
                    $result = $this->promoteRow($row, $admin);
                    if ($result['ok']) {
                        $promoted++;
                    } else {
                        $errors[] = ['id' => $row->id, 'name' => $row->name, 'reason' => $result['message']];
                    }
                }
            });

            return $this->success(
                ['promoted' => $promoted, 'skipped' => count($errors), 'errors' => array_slice($errors, 0, 50)],
                "{$promoted} promoted" . (count($errors) ? ', ' . count($errors) . ' skipped' : '')
            );
        }

        $request->validate([
            'ids' => 'required|array|min:1|max:500',
            'ids.*' => 'integer',
        ]);

        $rows = ScrapedProduct::whereIn('id', $request->ids)->where('status', 'pending')->get();

        $promoted = 0;
        $errors = [];
        foreach ($rows as $row) {
            $result = $this->promoteRow($row, $admin);
            if ($result['ok']) {
                $promoted++;
            } else {
                $errors[] = ['id' => $row->id, 'name' => $row->name, 'reason' => $result['message']];
            }
        }
        // Covers both ids that were never pending/found (not in $rows at all) and rows that
        // were pending but failed promoteRow() -- both are "requested but not promoted".
        $skipped = count($request->ids) - $promoted;

        return $this->success(
            ['promoted' => $promoted, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 50)],
            "{$promoted} promoted" . ($skipped ? ", {$skipped} skipped" : '')
        );
    }

    /**
     * Shared by promote() and bulkPromote() -- one copy of the duplicate-guard + Product::create()
     * + audit-log logic so the single and bulk paths can never quietly drift apart.
     *
     * @return array{ok: bool, message?: string, product?: Product}
     */
    private function promoteRow(ScrapedProduct $scraped, User $admin): array
    {
        if (!$scraped->canPromote()) {
            return ['ok' => false, 'message' => 'Needs a mapped category and a price greater than 0.'];
        }

        // Same soft-delete-aware duplicate guard ProductBulkImport applies against the live catalog.
        if ($scraped->sku && Product::where('sku', $scraped->sku)->exists()) {
            return ['ok' => false, 'message' => "SKU '{$scraped->sku}' already exists."];
        }
        if (Product::whereRaw('LOWER(name) = ?', [Str::lower(trim($scraped->name))])->exists()) {
            return ['ok' => false, 'message' => "A product named '{$scraped->name}' already exists."];
        }

        $product = DB::transaction(function () use ($scraped, $admin) {
            $image = $this->copyToFreshPath($scraped->image, 'products');
            $gallery = collect($scraped->gallery ?? [])
                ->map(fn ($path) => $this->copyToFreshPath($path, 'products/gallery'))
                ->filter()
                ->values()
                ->all();

            $product = Product::create(array_merge($this->scrapedFieldsToProductPayload($scraped), [
                'image' => $image,
                'gallery' => !empty($gallery) ? $gallery : null,
                'always_in_stock' => false,
                'is_active' => false,
                'is_draft' => false,
                // 'bulk_import' (not a distinct 'scraped' value) so a promoted product shows up
                // under the Products list's existing "Bulk Upload" tab/badge/filter — same
                // treatment as an Excel-uploaded product, no separate UI needed. bulk_upload_batch
                // still tells the two apart if it ever matters (this one looks like
                // "monitor-20260903-140215", an Excel batch looks like "BULK-20260903-140215-A1B2").
                'source' => 'bulk_import',
                'bulk_upload_batch' => $scraped->batch,
                // Carried over so the product's edit page can still show where it came from,
                // even after this staging row is eventually deleted.
                'source_site' => $scraped->source_site,
                'source_url' => $scraped->source_url,
                'source_product_id' => $scraped->source_product_id,
                'created_by' => $admin->id,
            ]));

            $scraped->update([
                'status' => 'promoted',
                'promoted_product_id' => $product->id,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            return $product;
        });

        AuditLog::log($admin, 'create_product', 'Product', $product->id, null, $product->toArray(), "Promoted from scraped product #{$scraped->id}");

        return ['ok' => true, 'product' => $product];
    }

    /**
     * The ScrapedProduct -> Product field mapping shared by promoteRow() (creation) and
     * syncStrongMatch() (updating an already-promoted product) -- one copy of "what a scraped
     * row's fields become on a real Product" so the two can never quietly drift apart. Image/
     * gallery are handled separately by each caller since promote() always copies fresh paths
     * while a sync only replaces them when a new file actually arrives. Workflow/ownership fields
     * (is_active, is_draft, source, created_by, source_site/url/product_id) are deliberately
     * excluded -- those aren't "scraped" data and must never flip back on a re-sync (an admin
     * activating a product on the storefront must survive its next re-scrape).
     */
    private function scrapedFieldsToProductPayload(ScrapedProduct $scraped): array
    {
        return [
            'category_id' => $scraped->category_id,
            'brand_id' => $scraped->brand_id,
            'sku' => $scraped->sku,
            'name' => $scraped->name,
            'name_bn' => $scraped->name_bn,
            'description' => $scraped->description,
            'short_description' => $scraped->short_description,
            'specifications' => $scraped->specifications,
            'price' => (float) $scraped->price,
            'discount_price' => $scraped->discount_price !== null ? (float) $scraped->discount_price : null,
            'stock_qty' => $scraped->stock_qty ?? 0,
            'current_cost' => $scraped->current_cost !== null ? (float) $scraped->current_cost : null,
            'unit' => $scraped->unit ?: 'piece',
            'model' => $scraped->model,
            'warranty_value' => $scraped->warranty_value,
            'warranty_unit' => $scraped->warranty_unit,
        ];
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
        $reason = $request->get('reason');

        if ($request->boolean('select_all')) {
            $query = $this->applyScrapedProductFilters(ScrapedProduct::query(), $request)->where('status', 'pending');

            $rejected = 0;
            $query->chunkById(200, function ($rows) use ($admin, $reason, &$rejected) {
                foreach ($rows as $row) {
                    $row->update([
                        'status' => 'rejected',
                        'reject_reason' => $reason,
                        'reviewed_by' => $admin->id,
                        'reviewed_at' => now(),
                    ]);
                    $rejected++;
                }
            });

            return $this->success(['rejected' => $rejected, 'skipped' => 0], "{$rejected} rejected");
        }

        $request->validate([
            'ids' => 'required|array|min:1|max:200',
            'ids.*' => 'integer',
            'reason' => 'nullable|string|max:255',
        ]);

        $rows = ScrapedProduct::whereIn('id', $request->ids)->where('status', 'pending')->get();

        foreach ($rows as $row) {
            $row->update([
                'status' => 'rejected',
                'reject_reason' => $reason,
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

    /**
     * Bulk delete — a specific set of ids, or (select_all) every row matching the current
     * category/brand/status/search filters, so "clear out this whole brand" or "clear out
     * everything rejected" is one click. Promoted rows are never deletable here (same guard as
     * the single destroy()) — skipped and counted, never treated as a request failure.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        if ($request->boolean('select_all')) {
            $query = $this->applyScrapedProductFilters(ScrapedProduct::query(), $request)->where('status', '!=', 'promoted');

            $deleted = 0;
            $query->chunkById(200, function ($rows) use (&$deleted) {
                foreach ($rows as $row) {
                    $row->delete();
                    $deleted++;
                }
            });

            return $this->success(['deleted' => $deleted, 'skipped' => 0], "{$deleted} deleted");
        }

        $request->validate([
            'ids' => 'required|array|min:1|max:500',
            'ids.*' => 'integer',
        ]);

        $rows = ScrapedProduct::whereIn('id', $request->ids)->where('status', '!=', 'promoted')->get();
        foreach ($rows as $row) {
            $row->delete();
        }

        $deletedCount = $rows->count();
        $skipped = count($request->ids) - $deletedCount;

        return $this->success(
            ['deleted' => $deletedCount, 'skipped' => $skipped],
            "{$deletedCount} deleted" . ($skipped > 0 ? ", {$skipped} skipped (already promoted or gone)" : '')
        );
    }
}
