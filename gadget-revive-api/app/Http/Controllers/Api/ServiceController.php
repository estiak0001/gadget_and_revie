<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Service::active()->with(['category.parent.parent.parent', 'vendorProfile']);

        // Filter by category (includes all descendants)
        if ($request->has('category_id')) {
            $categoryIds = $this->getAllDescendantIds((int) $request->category_id);
            $query->whereIn('category_id', $categoryIds);
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
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Price range
        if ($request->has('min_price')) {
            $query->where('base_price', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('base_price', '<=', $request->max_price);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'sort_order');
        $sortOrder = $request->get('sort_order', 'asc');

        switch ($sortBy) {
            case 'price':
                $query->orderBy('base_price', $sortOrder);
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
        $services = $query->paginate($perPage);

        return $this->paginated($services);
    }

    public function show(string $id): JsonResponse
    {
        $query = Service::active()->with(['category.parent.parent.parent', 'vendorProfile.division', 'vendorProfile.district']);

        // If numeric, find by ID; otherwise treat as slug
        if (is_numeric($id)) {
            $service = $query->findOrFail((int)$id);
        } else {
            $service = $query->where('slug', $id)->firstOrFail();
        }

        return $this->success(new ServiceResource($service));
    }

    public function featured(): JsonResponse
    {
        // Random order each request so all featured services rotate through this slot over
        // time — a fixed orderBy('sort_order') would always show the same first 10 and let
        // the rest of the featured catalog never surface here.
        $services = Service::active()
            ->featured()
            ->with(['category', 'vendorProfile'])
            ->inRandomOrder()
            ->limit(12)
            ->get();

        return $this->success(ServiceResource::collection($services));
    }

    public function byCategory(int $categoryId): JsonResponse
    {
        $categoryIds = $this->getAllDescendantIds($categoryId);
        $services = Service::active()
            ->whereIn('category_id', $categoryIds)
            ->with(['category.parent.parent.parent', 'vendorProfile'])
            ->orderBy('sort_order')
            ->paginate(15);

        return $this->paginated($services);
    }

    private function getAllDescendantIds(int $categoryId): array
    {
        $ids      = [$categoryId];
        $children = ServiceCategory::where('parent_id', $categoryId)->pluck('id');
        foreach ($children as $childId) {
            $ids = array_merge($ids, $this->getAllDescendantIds($childId));
        }
        return $ids;
    }
}
