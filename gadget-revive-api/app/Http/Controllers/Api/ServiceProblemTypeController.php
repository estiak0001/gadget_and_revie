<?php

namespace App\Http\Controllers\Api;

use App\Models\ServiceProblemType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * CRUD for the Service Intake item "Problem Type" dropdown's options (e.g. Recovery, Repair) --
 * managed directly from the intake form, same shape as ExpenseController's category CRUD.
 */
class ServiceProblemTypeController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $types = ServiceProblemType::withCount('items')
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        return $this->success($types);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('service_problem_types', 'name')->whereNull('deleted_at')],
        ]);

        $type = ServiceProblemType::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'is_active' => true,
        ]);

        return $this->created($type, 'Problem type added.');
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $type = ServiceProblemType::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100', Rule::unique('service_problem_types', 'name')->ignore($id)->whereNull('deleted_at')],
            'is_active' => 'nullable|boolean',
        ]);

        $type->update($data);

        return $this->success($type->fresh(), 'Problem type updated.');
    }

    public function destroy(int $id): JsonResponse
    {
        $type = ServiceProblemType::withCount('items')->findOrFail($id);

        if ($type->items_count > 0) {
            return $this->error('Cannot delete a problem type that\'s already used on an intake item.', 422);
        }

        $type->delete();

        return $this->noContent('Problem type deleted.');
    }
}
