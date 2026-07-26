<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\DivisionResource;
use App\Http\Resources\DistrictResource;
use App\Http\Resources\AreaResource;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\District;
use App\Models\Area;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends BaseController
{
    public function divisions(): JsonResponse
    {
        $divisions = Division::active()->orderBy('name')->get();

        return $this->success(DivisionResource::collection($divisions));
    }

    public function districts(Request $request, $division = null): JsonResponse
    {
        $query = District::active()->orderBy('name');

        // Support both route parameter and query parameter
        $divisionId = $division ?? $request->get('division_id');
        
        if ($divisionId) {
            $query->where('division_id', $divisionId);
        }

        $districts = $query->with('division')->get();

        return $this->success(DistrictResource::collection($districts));
    }

    public function areas(Request $request, $district = null): JsonResponse
    {
        $query = Area::active()->orderBy('name');

        // Support both route parameter and query parameter
        $districtId = $district ?? $request->get('district_id');
        
        if ($districtId) {
            $query->where('district_id', $districtId);
        }

        $areas = $query->with('district.division')->get();

        return $this->success(AreaResource::collection($areas));
    }

    public function divisionsWithDistricts(): JsonResponse
    {
        $divisions = Division::active()
            ->with(['districts' => function ($query) {
                $query->active()->orderBy('name');
            }])
            ->orderBy('name')
            ->get();

        return $this->success(DivisionResource::collection($divisions));
    }

    public function districtsWithAreas(int $divisionId): JsonResponse
    {
        $districts = District::active()
            ->where('division_id', $divisionId)
            ->with(['areas' => function ($query) {
                $query->active()->orderBy('name');
            }])
            ->orderBy('name')
            ->get();

        return $this->success(DistrictResource::collection($districts));
    }

    public function fullHierarchy(): JsonResponse
    {
        $divisions = Division::active()
            ->with(['districts' => function ($query) {
                $query->active()->orderBy('name')->with(['areas' => function ($q) {
                    $q->active()->orderBy('name');
                }]);
            }])
            ->orderBy('name')
            ->get();

        return $this->success(DivisionResource::collection($divisions));
    }

    public function search(Request $request): JsonResponse
    {
        $query = $request->get('q', '');
        
        if (strlen($query) < 2) {
            return $this->error('Search query must be at least 2 characters', 422);
        }

        $divisions = Division::active()
            ->where('name', 'like', "%{$query}%")
            ->orWhere('name_bn', 'like', "%{$query}%")
            ->limit(5)
            ->get();

        $districts = District::active()
            ->where('name', 'like', "%{$query}%")
            ->orWhere('name_bn', 'like', "%{$query}%")
            ->with('division')
            ->limit(10)
            ->get();

        $areas = Area::active()
            ->where('name', 'like', "%{$query}%")
            ->orWhere('name_bn', 'like', "%{$query}%")
            ->with('district.division')
            ->limit(20)
            ->get();

        return $this->success([
            'divisions' => DivisionResource::collection($divisions),
            'districts' => DistrictResource::collection($districts),
            'areas' => AreaResource::collection($areas),
        ]);
    }

    // ========== ADMIN DIVISION CRUD ==========

    public function storeDivision(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:divisions,name',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $data = $request->only(['name', 'name_bn', 'is_active']);
        $data['is_active'] = $request->boolean('is_active', true);

        $division = Division::create($data);

        AuditLog::log($request->user(), 'create_division', 'Division', $division->id, null, $division->toArray(), 'Division created');

        return $this->created(new DivisionResource($division), 'Division created');
    }

    public function updateDivision(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255|unique:divisions,name,' . $id,
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $division = Division::findOrFail($id);
        $oldData = $division->toArray();

        $division->update($request->only(['name', 'name_bn', 'is_active']));

        AuditLog::log($request->user(), 'update_division', 'Division', $division->id, $oldData, $division->toArray(), 'Division updated');

        return $this->success(new DivisionResource($division), 'Division updated');
    }

    public function deleteDivision(Request $request, int $id): JsonResponse
    {
        $division = Division::findOrFail($id);

        if ($division->districts()->count() > 0) {
            return $this->error('Cannot delete division with districts', 422);
        }

        AuditLog::log($request->user(), 'delete_division', 'Division', $division->id, $division->toArray(), null, 'Division deleted');

        $division->delete();

        return $this->success(null, 'Division deleted');
    }

    // ========== ADMIN DISTRICT CRUD ==========

    public function storeDistrict(Request $request): JsonResponse
    {
        $request->validate([
            'division_id' => 'required|exists:divisions,id',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $data = $request->only(['division_id', 'name', 'name_bn', 'is_active']);
        $data['is_active'] = $request->boolean('is_active', true);

        $district = District::create($data);

        AuditLog::log($request->user(), 'create_district', 'District', $district->id, null, $district->toArray(), 'District created');

        return $this->created(new DistrictResource($district->load('division')), 'District created');
    }

    public function updateDistrict(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'division_id' => 'sometimes|exists:divisions,id',
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $district = District::findOrFail($id);
        $oldData = $district->toArray();

        $district->update($request->only(['division_id', 'name', 'name_bn', 'is_active']));

        AuditLog::log($request->user(), 'update_district', 'District', $district->id, $oldData, $district->toArray(), 'District updated');

        return $this->success(new DistrictResource($district->fresh('division')), 'District updated');
    }

    public function deleteDistrict(Request $request, int $id): JsonResponse
    {
        $district = District::findOrFail($id);

        if ($district->areas()->count() > 0) {
            return $this->error('Cannot delete district with areas', 422);
        }

        AuditLog::log($request->user(), 'delete_district', 'District', $district->id, $district->toArray(), null, 'District deleted');

        $district->delete();

        return $this->success(null, 'District deleted');
    }

    // ========== ADMIN AREA CRUD ==========

    public function storeArea(Request $request): JsonResponse
    {
        $request->validate([
            'district_id' => 'required|exists:districts,id',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $data = $request->only(['district_id', 'name', 'name_bn', 'is_active']);
        $data['is_active'] = $request->boolean('is_active', true);

        $area = Area::create($data);

        AuditLog::log($request->user(), 'create_area', 'Area', $area->id, null, $area->toArray(), 'Area created');

        return $this->created(new AreaResource($area->load('district.division')), 'Area created');
    }

    public function updateArea(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'district_id' => 'sometimes|exists:districts,id',
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        $area = Area::findOrFail($id);
        $oldData = $area->toArray();

        $area->update($request->only(['district_id', 'name', 'name_bn', 'is_active']));

        AuditLog::log($request->user(), 'update_area', 'Area', $area->id, $oldData, $area->toArray(), 'Area updated');

        return $this->success(new AreaResource($area->fresh('district.division')), 'Area updated');
    }

    public function deleteArea(Request $request, int $id): JsonResponse
    {
        $area = Area::findOrFail($id);

        AuditLog::log($request->user(), 'delete_area', 'Area', $area->id, $area->toArray(), null, 'Area deleted');

        $area->delete();

        return $this->success(null, 'Area deleted');
    }
}
