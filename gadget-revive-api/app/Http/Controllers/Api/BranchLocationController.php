<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\BranchLocationResource;
use App\Models\BranchLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BranchLocationController extends BaseController
{
    // -----------------------------------------------------------------------
    // Public endpoints
    // -----------------------------------------------------------------------

    /**
     * List all active branch locations (public).
     */
    public function index(Request $request): JsonResponse
    {
        $locations = BranchLocation::active()
            ->orderBy('is_featured', 'desc')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success(BranchLocationResource::collection($locations));
    }

    /**
     * Get a single active branch location (public).
     */
    public function show(int $id): JsonResponse
    {
        $location = BranchLocation::active()->find($id);

        if (!$location) {
            return $this->error('Branch location not found', 404);
        }

        return $this->success(new BranchLocationResource($location));
    }

    /**
     * Get the featured (main) branch location (public).
     */
    public function featured(): JsonResponse
    {
        $location = BranchLocation::active()
            ->featured()
            ->orderBy('sort_order')
            ->first();

        if (!$location) {
            $location = BranchLocation::active()
                ->orderBy('sort_order')
                ->first();
        }

        return $this->success($location ? new BranchLocationResource($location) : null);
    }

    // -----------------------------------------------------------------------
    // Admin endpoints (require auth + admin middleware)
    // -----------------------------------------------------------------------

    /**
     * List all branch locations for admin (includes inactive).
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $query = BranchLocation::query();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('address', 'like', "%{$search}%")
                  ->orWhere('type', 'like', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $locations = $query->orderBy('is_featured', 'desc')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($request->get('per_page', 20));

        return $this->success($locations->through(fn ($l) => new BranchLocationResource($l)));
    }

    /**
     * Create a new branch location.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'name'          => 'required|string|max:255',
                'type'          => 'required|string|max:100',
                'address'       => 'required|string|max:500',
                'phone'         => 'required|string|max:50',
                'email'         => 'nullable|email|max:255',
                'hours'         => 'nullable|string|max:255',
                'services'      => 'nullable|array',
                'services.*'    => 'string|max:100',
                'map_url'       => 'nullable|url|max:1000',
                'map_embed_url' => 'nullable|string|max:2000',
                'latitude'      => 'nullable|numeric|between:-90,90',
                'longitude'     => 'nullable|numeric|between:-180,180',
                'is_featured'   => 'boolean',
                'is_active'     => 'boolean',
                'sort_order'    => 'integer|min:0',
            ]);
        } catch (ValidationException $e) {
            return $this->error('Validation failed', 422, $e->errors());
        }

        // Ensure only one featured location
        if (!empty($data['is_featured']) && $data['is_featured']) {
            BranchLocation::where('is_featured', true)->update(['is_featured' => false]);
        }

        $location = BranchLocation::create($data);

        return $this->success(new BranchLocationResource($location), 201);
    }

    /**
     * Update a branch location.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $location = BranchLocation::find($id);

        if (!$location) {
            return $this->error('Branch location not found', 404);
        }

        try {
            $data = $request->validate([
                'name'          => 'sometimes|required|string|max:255',
                'type'          => 'sometimes|required|string|max:100',
                'address'       => 'sometimes|required|string|max:500',
                'phone'         => 'sometimes|required|string|max:50',
                'email'         => 'nullable|email|max:255',
                'hours'         => 'nullable|string|max:255',
                'services'      => 'nullable|array',
                'services.*'    => 'string|max:100',
                'map_url'       => 'nullable|url|max:1000',
                'map_embed_url' => 'nullable|string|max:2000',
                'latitude'      => 'nullable|numeric|between:-90,90',
                'longitude'     => 'nullable|numeric|between:-180,180',
                'is_featured'   => 'boolean',
                'is_active'     => 'boolean',
                'sort_order'    => 'integer|min:0',
            ]);
        } catch (ValidationException $e) {
            return $this->error('Validation failed', 422, $e->errors());
        }

        // Ensure only one featured location
        if (isset($data['is_featured']) && $data['is_featured']) {
            BranchLocation::where('is_featured', true)
                ->where('id', '!=', $id)
                ->update(['is_featured' => false]);
        }

        $location->update($data);

        return $this->success(new BranchLocationResource($location->fresh()));
    }

    /**
     * Delete a branch location.
     */
    public function destroy(int $id): JsonResponse
    {
        $location = BranchLocation::find($id);

        if (!$location) {
            return $this->error('Branch location not found', 404);
        }

        $location->delete();

        return $this->success(['message' => 'Branch location deleted successfully']);
    }
}
