<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ProductResource;
use App\Http\Resources\ProductBrandResource;
use App\Models\Product;
use App\Models\ProductBrand;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::active()->with([
            'category.parent.parent.parent',
            'vendorProfile',
            'brand',
            'attributeValues.attribute',
            'attributeValues.attributeValue',
        ]);

        // Filter by category — includes all descendant subcategories
        if ($request->has('category_id')) {
            $categoryId = (int) $request->category_id;
            $allIds = $this->getAllDescendantIds($categoryId);
            $query->whereIn('category_id', $allIds);
        }

        // Dynamic attribute filters.
        // Accepted formats:
        //   attributes[attribute_slug][]=value_id
        //   attribute_values[]=value_id (flat list across attributes)
        $attributeFilters = $this->collectAttributeFilters($request);
        if (!empty($attributeFilters)) {
            // Product must match ALL selected attributes (AND across attributes).
            // Within an attribute, any listed value matches (OR).
            foreach ($attributeFilters as $attrKey => $valueIds) {
                $query->whereHas('attributeValues', function ($q) use ($valueIds) {
                    $q->whereIn('attribute_value_id', $valueIds);
                });
            }
        }

        // Filter by vendor
        if ($request->has('vendor_id')) {
            $query->where('vendor_profile_id', $request->vendor_id);
        }

        // Filter by location (through vendor)
        if ($request->has('division_id') || $request->has('district_id') || $request->has('area_id')) {
            $query->whereHas('vendorProfile', function ($q) use ($request) {
                $q->active();
                if ($request->has('division_id')) {
                    $q->where('division_id', $request->division_id);
                }
                if ($request->has('district_id')) {
                    $q->where('district_id', $request->district_id);
                }
                if ($request->has('area_id')) {
                    $q->where('area_id', $request->area_id);
                }
            });
        }

        // Filter by stock
        if ($request->boolean('in_stock')) {
            $query->inStock();
        }

        // Filter by featured
        if ($request->boolean('featured')) {
            $query->featured();
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%");
            });
        }

        // Price range
        if ($request->has('min_price')) {
            $query->where('price', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('price', '<=', $request->max_price);
        }

        // Brand filter (supports single brand_id or array brand_ids[])
        if ($request->has('brand_ids') && is_array($request->brand_ids)) {
            $brandIds = array_values(array_filter(array_map('intval', $request->brand_ids), fn($v) => $v > 0));
            if (!empty($brandIds)) {
                $query->whereIn('brand_id', $brandIds);
            }
        } elseif ($request->has('brand_id')) {
            $query->where('brand_id', $request->brand_id);
        } elseif ($request->has('brand')) {
            $query->where('brand', $request->brand);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'sort_order');
        $sortOrder = $request->get('sort_order', 'asc');

        switch ($sortBy) {
            case 'price_low':
                $query->orderBy('price', 'asc');
                break;
            case 'price_high':
                $query->orderBy('price', 'desc');
                break;
            case 'name':
                $query->orderBy('name', $sortOrder);
                break;
            case 'newest':
                $query->orderBy('created_at', 'desc');
                break;
            default:
                $query->orderBy('sort_order', $sortOrder);
        }

        $perPage = min($request->get('per_page', 15), 50);
        $products = $query->paginate($perPage);
        $products->getCollection()->transform(fn ($product) => new ProductResource($product));

        return $this->paginated($products);
    }

    /**
     * Recursively collect the given category ID plus all its descendant IDs.
     */
    private function getAllDescendantIds(int $categoryId): array
    {
        $ids = [$categoryId];
        $children = ProductCategory::where('parent_id', $categoryId)->pluck('id')->toArray();
        foreach ($children as $childId) {
            $ids = array_merge($ids, $this->getAllDescendantIds($childId));
        }
        return $ids;
    }

    /**
     * Normalize dynamic attribute filters from the request.
     * Returns: [ 'attribute_key' => [valueId, valueId, ...], ... ]
     *
     * Supports:
     *   attributes[slug][]=valueId
     *   attributes[attrId][]=valueId
     *   attribute_values[]=valueId  (flat; grouped by their attribute_id)
     */
    private function collectAttributeFilters(Request $request): array
    {
        $groups = [];

        $structured = $request->input('attributes');
        if (is_array($structured)) {
            foreach ($structured as $key => $valueList) {
                if (!is_array($valueList)) {
                    $valueList = array_filter(array_map('trim', explode(',', (string) $valueList)));
                }
                $valueIds = array_values(array_filter(array_map('intval', $valueList), fn($v) => $v > 0));
                if (!empty($valueIds)) {
                    $groups[(string) $key] = $valueIds;
                }
            }
        }

        $flat = $request->input('attribute_values');
        if (is_array($flat) && !empty($flat)) {
            $valueIds = array_values(array_filter(array_map('intval', $flat), fn($v) => $v > 0));
            if (!empty($valueIds)) {
                $valuesByAttr = \App\Models\AttributeValue::whereIn('id', $valueIds)
                    ->get(['id', 'attribute_id'])
                    ->groupBy('attribute_id');

                foreach ($valuesByAttr as $attrId => $rows) {
                    $key = 'attr_' . $attrId;
                    $existing = $groups[$key] ?? [];
                    $groups[$key] = array_values(array_unique(array_merge($existing, $rows->pluck('id')->all())));
                }
            }
        }

        return $groups;
    }

    public function show(string $slug): JsonResponse
    {
        $product = Product::where('slug', $slug)
            ->active()
            ->with(['category.parent.parent.parent', 'vendorProfile.division', 'vendorProfile.district', 'brand'])
            ->firstOrFail();

        return $this->success(new ProductResource($product));
    }

    public function featured(): JsonResponse
    {
        // Random order each request so all featured products rotate through this slot over
        // time — a fixed orderBy('sort_order') would always show the same first 10 and let
        // the rest of the featured catalog never surface here.
        $products = Product::active()
            ->featured()
            ->inStock()
            ->with(['category.parent.parent.parent', 'vendorProfile', 'brand'])
            ->inRandomOrder()
            ->limit(30)
            ->get();

        return $this->success(ProductResource::collection($products));
    }

    public function byCategory(int $categoryId): JsonResponse
    {
        $products = Product::active()
            ->where('category_id', $categoryId)
            ->inStock()
            ->with(['category.parent.parent.parent', 'vendorProfile', 'brand'])
            ->orderBy('sort_order')
            ->paginate(15);
        $products->getCollection()->transform(fn ($product) => new ProductResource($product));

        return $this->paginated($products);
    }

    public function checkStock(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        return $this->success([
            'product_id' => $product->id,
            'stock_qty' => $product->stock_qty,
            'is_in_stock' => $product->isInStock(),
            'is_low_stock' => $product->isLowStock(),
        ]);
    }

    public function brandsByCategory(int $categoryId): JsonResponse
    {
        $categoryIds = $this->getAllDescendantIds($categoryId);

        $brands = ProductBrand::where('is_active', true)
            ->whereHas('products', function ($q) use ($categoryIds) {
                $q->whereIn('category_id', $categoryIds);
            })
            ->withCount('products')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success(ProductBrandResource::collection($brands));
    }

    public function brands(Request $request): JsonResponse
    {
        $query = ProductBrand::where('is_active', true);

        if ($request->filled('category_id')) {
            $categoryId = (int) $request->category_id;
            $categoryIds = $this->getAllDescendantIds($categoryId);
            $query->whereHas('products', function ($q) use ($categoryIds) {
                $q->whereIn('category_id', $categoryIds);
            });
        }

        $brands = $query
            ->withCount('products')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success(ProductBrandResource::collection($brands));
    }
}
