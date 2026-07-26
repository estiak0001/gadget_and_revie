<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query();

        if ($request->filled('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }
        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return $this->paginated($query->latest()->paginate($request->get('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $supplier = Supplier::create($data);

        AuditLog::log($request->user(), 'create_supplier', 'Supplier', $supplier->id, null, $supplier->toArray(), 'Supplier created');

        return $this->created($supplier);
    }

    public function show(int $id): JsonResponse
    {
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return $this->notFound('Supplier not found');
        }

        return $this->success($supplier);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $supplier = Supplier::find($id);
        if (!$supplier) {
            return $this->notFound('Supplier not found');
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $old = $supplier->toArray();
        $supplier->update($data);

        AuditLog::log($request->user(), 'update_supplier', 'Supplier', $supplier->id, $old, $supplier->toArray(), 'Supplier updated');

        return $this->success($supplier);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $supplier = Supplier::withCount('purchaseOrders')->find($id);
        if (!$supplier) {
            return $this->notFound('Supplier not found');
        }
        if ($supplier->purchase_orders_count > 0) {
            return $this->error('Cannot delete a supplier that has purchase orders', 422);
        }

        $supplier->delete();

        AuditLog::log($request->user(), 'delete_supplier', 'Supplier', $id, null, null, 'Supplier deleted');

        return $this->noContent('Supplier deleted');
    }
}
