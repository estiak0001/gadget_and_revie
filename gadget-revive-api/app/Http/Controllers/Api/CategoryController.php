<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ServiceCategoryResource;
use App\Http\Resources\ProductCategoryResource;
use App\Models\AuditLog;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends BaseController
{
    // Service Categories
    public function serviceCategories(Request $request): JsonResponse
    {
        $query = ServiceCategory::active()->orderBy('sort_order');

        if ($request->boolean('parent_only')) {
            $query->parentCategories();
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        if ($request->has('top_level_id')) {
            $topId = (int) $request->top_level_id;
            $childIds = ServiceCategory::where('parent_id', $topId)->pluck('id')->toArray();
            $query->where(function ($q) use ($topId, $childIds) {
                $q->where('parent_id', $topId)
                    ->orWhereIn('parent_id', $childIds);
            });
        }

        $categories = $query->with('parent.parent')->withCount('services')->get();

        // Opt-in: real subtree stats (count + lowest active price) for the storefront's
        // category-card grids (e.g. the /services landing page), which need "N services,
        // starting from ৳X" per card without an extra request each. Overwrites the plain
        // withCount('services') above (direct children only) with the true, recursive subtree
        // count — the same "flat category" figure used on a single category's own page.
        if ($request->boolean('with_stats')) {
            foreach ($categories as $category) {
                $descendantIds = $category->allDescendantIds();
                $stats = Service::whereIn('category_id', $descendantIds)
                    ->active()
                    ->selectRaw('COUNT(*) as cnt, MIN(COALESCE(discount_price, base_price)) as min_price')
                    ->first();
                $category->setAttribute('services_count', (int) $stats->cnt);
                $category->setAttribute('starting_price', $stats->min_price);
            }
        }

        return $this->success(ServiceCategoryResource::collection($categories));
    }

    public function serviceCategoriesWithChildren(): JsonResponse
    {
        $categories = ServiceCategory::active()
            ->parentCategories()
            ->with(['children' => function ($query) {
                $query->active()->orderBy('sort_order')
                    ->with(['children' => function ($q) {
                        $q->active()->orderBy('sort_order');
                    }]);
            }])
            ->withCount('services')
            ->orderBy('sort_order')
            ->get();

        return $this->success(ServiceCategoryResource::collection($categories));
    }

    public function serviceCategory(string $slug): JsonResponse
    {
        // The storefront category page is flat — it shows every service anywhere in this
        // category's subtree (see ServiceController::index's own descendant-id resolution),
        // not a tree of sub-category cards to click through. So all this needs is the
        // category itself (for the hero) plus real stats computed over its whole subtree.
        $category = ServiceCategory::where('slug', $slug)
            ->active()
            ->with('parent.parent.parent')
            ->firstOrFail();

        $descendantIds = $category->allDescendantIds();
        $activeServices = Service::whereIn('category_id', $descendantIds)
            ->active()
            ->orderByRaw('COALESCE(discount_price, base_price) asc')
            ->get(['id', 'name', 'slug', 'base_price', 'discount_price', 'duration_estimate', 'image', 'short_description']);

        $category->setAttribute('services_count', $activeServices->count());
        $category->setAttribute(
            'starting_price',
            $activeServices->isEmpty() ? null : ($activeServices->first()->discount_price ?: $activeServices->first()->base_price)
        );

        // Up to 3 real services picked by price — cheapest, middle, priciest — relabeled as a
        // simple Basic/Minor/Major pricing ladder so the category page can show 3 clean cards
        // instead of the full catalog. A heuristic (price order), not an admin-assigned tier —
        // real services and real prices throughout, nothing fabricated.
        $tierLabels = ['Basic', 'Minor', 'Major'];
        $count = $activeServices->count();
        $picks = match (true) {
            $count === 0 => [],
            $count <= 3 => $activeServices->all(),
            default => [$activeServices->first(), $activeServices->get(intdiv($count - 1, 2)), $activeServices->last()],
        };
        $category->setAttribute('tier_services', collect($picks)->values()->map(fn ($svc, $i) => [
            'tier' => $tierLabels[$i] ?? null,
            'id' => $svc->id,
            'name' => $svc->name,
            'slug' => $svc->slug,
            'price' => $svc->discount_price ?: $svc->base_price,
            'duration_estimate' => $svc->duration_estimate,
            'image' => $svc->image ? asset('storage/' . $svc->image) : null,
            'short_description' => $svc->short_description,
        ])->all());

        return $this->success(new ServiceCategoryResource($category));
    }

    // Product Categories
    public function productCategories(Request $request): JsonResponse
    {
        $query = ProductCategory::active()->orderBy('sort_order');

        if ($request->boolean('parent_only')) {
            $query->parentCategories();
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        if ($request->has('top_level_id')) {
            $topId = (int) $request->top_level_id;
            $childIds = ProductCategory::where('parent_id', $topId)->pluck('id')->toArray();
            $query->where(function ($q) use ($topId, $childIds) {
                $q->where('parent_id', $topId)
                    ->orWhereIn('parent_id', $childIds);
            });
        }

        if ($request->boolean('is_featured')) {
            $query->where('is_featured', true);
        }

        $categories = $query->with('parent.parent')->withCount('products')->get();

        return $this->success(ProductCategoryResource::collection($categories));
    }

    public function productCategoriesWithChildren(): JsonResponse
    {
        $categories = ProductCategory::active()
            ->parentCategories()
            ->with(['children' => function ($query) {
                $query->active()->orderBy('sort_order')
                    ->with(['children' => function ($q) {
                        $q->active()->orderBy('sort_order');
                    }]);
            }])
            ->withCount('products')
            ->orderBy('sort_order')
            ->get();

        return $this->success(ProductCategoryResource::collection($categories));
    }

    public function productCategory(string $slug): JsonResponse
    {
        $category = ProductCategory::where('slug', $slug)
            ->active()
            ->with(['parent.parent', 'children' => function ($query) {
                $query->active()->orderBy('sort_order')
                    ->with(['children' => function ($q) {
                        $q->active()->orderBy('sort_order');
                    }]);
            }])
            ->withCount('products')
            ->firstOrFail();

        return $this->success(new ProductCategoryResource($category));
    }

    // ========== ADMIN SERVICE CATEGORIES ==========

    public function adminServiceCategories(Request $request): JsonResponse
    {
        $query = ServiceCategory::query()->orderBy('sort_order');

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('parent_only')) {
            $query->parentCategories();
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        if ($request->has('top_level_id')) {
            $topId = (int) $request->top_level_id;
            $childIds = ServiceCategory::where('parent_id', $topId)->pluck('id')->toArray();
            $query->where(function ($q) use ($topId, $childIds) {
                $q->where('parent_id', $topId)
                    ->orWhereIn('parent_id', $childIds);
            });
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('name_bn', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $categories = $query->with(['parent.parent', 'children.children'])->withCount('services')->get();

        return $this->success(ServiceCategoryResource::collection($categories));
    }

    public function adminServiceCategoryShow(int $id): JsonResponse
    {
        $category = ServiceCategory::with(['parent.parent', 'children.children'])
            ->withCount('services')
            ->findOrFail($id);

        return $this->success(new ServiceCategoryResource($category));
    }

    public function storeServiceCategory(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:255',
            'image' => 'nullable|string|max:255',
            'parent_id' => 'nullable|exists:service_categories,id',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $data = $request->only(['name', 'name_bn', 'description', 'icon', 'image', 'parent_id', 'sort_order', 'is_active', 'is_featured']);
        $data['is_active'] = $request->boolean('is_active', true);
        $data['is_featured'] = $request->boolean('is_featured', false);
        $data['sort_order'] = $request->sort_order ?? 0;

        $category = ServiceCategory::create($data);

        AuditLog::log($request->user(), 'create_service_category', 'ServiceCategory', $category->id, null, $category->toArray(), 'Service category created');

        return $this->created(new ServiceCategoryResource($category->load(['parent.parent', 'children.children'])), 'Service category created');
    }

    public function updateServiceCategory(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:255',
            'image' => 'nullable|string|max:255',
            'parent_id' => 'nullable|exists:service_categories,id',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $category = ServiceCategory::findOrFail($id);
        $oldData = $category->toArray();

        $data = $request->only(['name', 'name_bn', 'description', 'icon', 'image', 'parent_id', 'sort_order', 'is_active', 'is_featured']);
        if ($request->has('is_featured')) {
            $data['is_featured'] = $request->boolean('is_featured');
        }
        $category->update($data);

        AuditLog::log($request->user(), 'update_service_category', 'ServiceCategory', $category->id, $oldData, $category->toArray(), 'Service category updated');

        return $this->success(new ServiceCategoryResource($category->fresh(['parent.parent', 'children.children'])), 'Service category updated');
    }

    public function deleteServiceCategory(Request $request, int $id): JsonResponse
    {
        $category = ServiceCategory::findOrFail($id);

        AuditLog::log($request->user(), 'delete_service_category', 'ServiceCategory', $category->id, $category->toArray(), null, 'Service category deleted');

        $category->delete();

        return $this->success(null, 'Service category deleted');
    }

    // ========== ADMIN PRODUCT CATEGORIES ==========

    public function adminProductCategories(Request $request): JsonResponse
    {
        $query = ProductCategory::query()->orderBy('sort_order');

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('parent_only')) {
            $query->parentCategories();
        }

        if ($request->has('parent_id')) {
            $query->where('parent_id', $request->parent_id);
        }

        if ($request->has('top_level_id')) {
            $topId = (int) $request->top_level_id;
            $childIds = ProductCategory::where('parent_id', $topId)->pluck('id')->toArray();
            $query->where(function ($q) use ($topId, $childIds) {
                $q->where('parent_id', $topId)
                    ->orWhereIn('parent_id', $childIds);
            });
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('name_bn', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $categories = $query->with(['parent.parent', 'children.children'])->withCount('products')->get();

        return $this->success(ProductCategoryResource::collection($categories));
    }

    public function adminProductCategoryShow(int $id): JsonResponse
    {
        $category = ProductCategory::with(['parent.parent', 'children.children'])
            ->withCount('products')
            ->findOrFail($id);

        return $this->success(new ProductCategoryResource($category));
    }

    public function storeProductCategory(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:255',
            'image' => 'nullable|string|max:255',
            'parent_id' => 'nullable|exists:product_categories,id',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $data = $request->only(['name', 'name_bn', 'description', 'icon', 'image', 'parent_id', 'sort_order', 'is_active', 'is_featured']);
        $data['is_active'] = $request->boolean('is_active', true);
        $data['is_featured'] = $request->boolean('is_featured', false);
        $data['sort_order'] = $request->sort_order ?? 0;

        $category = ProductCategory::create($data);

        AuditLog::log($request->user(), 'create_product_category', 'ProductCategory', $category->id, null, $category->toArray(), 'Product category created');

        return $this->created(new ProductCategoryResource($category->load(['parent.parent', 'children.children'])), 'Product category created');
    }

    public function updateProductCategory(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:255',
            'image' => 'nullable|string|max:255',
            'parent_id' => 'nullable|exists:product_categories,id',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ]);

        $category = ProductCategory::findOrFail($id);
        $oldData = $category->toArray();

        $data = $request->only(['name', 'name_bn', 'description', 'icon', 'image', 'parent_id', 'sort_order', 'is_active', 'is_featured']);
        if ($request->has('is_featured')) {
            $data['is_featured'] = $request->boolean('is_featured');
        }
        $category->update($data);

        AuditLog::log($request->user(), 'update_product_category', 'ProductCategory', $category->id, $oldData, $category->toArray(), 'Product category updated');

        return $this->success(new ProductCategoryResource($category->fresh(['parent.parent', 'children.children'])), 'Product category updated');
    }

    public function deleteProductCategory(Request $request, int $id): JsonResponse
    {
        $category = ProductCategory::findOrFail($id);

        AuditLog::log($request->user(), 'delete_product_category', 'ProductCategory', $category->id, $category->toArray(), null, 'Product category deleted');

        $category->delete();

        return $this->success(null, 'Product category deleted');
    }

    // ========== REORDER SERVICE CATEGORIES ==========

    /**
     * Reorder service categories (drag and drop)
     */
    public function reorderServiceCategories(Request $request): JsonResponse
    {
        $request->validate([
            'categories' => 'required|array',
            'categories.*.id' => 'required|exists:service_categories,id',
            'categories.*.sort_order' => 'required|integer|min:0',
        ]);

        $admin = $request->user();

        foreach ($request->categories as $item) {
            ServiceCategory::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        AuditLog::log($admin, 'reorder_service_categories', 'ServiceCategory', null, null, [
            'categories' => $request->categories,
        ], 'Service categories reordered');

        return $this->success(null, 'Service categories reordered successfully');
    }

    // ========== REORDER PRODUCT CATEGORIES ==========

    /**
     * Reorder product categories (drag and drop)
     */
    public function reorderProductCategories(Request $request): JsonResponse
    {
        $request->validate([
            'categories' => 'required|array',
            'categories.*.id' => 'required|exists:product_categories,id',
            'categories.*.sort_order' => 'required|integer|min:0',
        ]);

        $admin = $request->user();

        foreach ($request->categories as $item) {
            ProductCategory::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        AuditLog::log($admin, 'reorder_product_categories', 'ProductCategory', null, null, [
            'categories' => $request->categories,
        ], 'Product categories reordered');

        return $this->success(null, 'Product categories reordered successfully');
    }
}
