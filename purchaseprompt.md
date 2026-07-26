# Purchase Module — Implementation Prompt

This is a self-contained implementation spec for adding a **Purchase Order / stock procurement module** to Gadget Revive. It covers both repos:

- `gadget-revive-api` (Laravel 12) — new tables, models, controller, routes, RBAC, PDF
- `gadget-revive-admin` (Next.js 14) — new pages, types, `adminService` methods, sidebar nav

There is currently **no purchase/procurement/supplier concept anywhere in either codebase** (confirmed by exhaustive grep — the only "purchase" hit is an unrelated CMS copy string). This is a greenfield module. Everything below was derived from the actual conventions already in use in this codebase — follow them exactly rather than introducing new patterns.

---

## 1. Problem statement

Admins currently have no way to record buying stock **into** the platform. `products.stock_qty` can only move via: order sales (deduction), order cancellation/refund (return), or a vendor's ad-hoc "adjust stock" endpoint (`addition`/`deduction`/`adjustment`). There is no concept of:

- A **supplier** the platform buys from (distinct from `VendorProfile`, which is a marketplace seller with logins, ratings, approvals, payouts — the wrong shape for a procurement counterparty).
- A **Purchase Order** documenting what was ordered, from whom, at what cost, and its fulfillment status.
- A **"receive goods"** action that increases `stock_qty` and writes a traceable `InventoryLog` entry back to the PO that caused it.
- Any resulting **cost tracking** (linking procurement spend into the existing Expense reports).

---

## 2. Design decisions (read before implementing)

1. **New `Supplier` model, not `VendorProfile`.** `VendorProfile` is a heavyweight marketplace-seller entity (user login, approval workflow, ratings, payouts, service areas). A procurement supplier is just a company/contact record. Do not overload `VendorProfile`.
2. **Parent + line-items pattern**, mirroring `ServiceIntake`/`ServiceIntakeItem` (the most recently-added, most idiomatic module in this codebase): `PurchaseOrder` (soft-deletes) + `PurchaseOrderItem` (no soft-deletes, cascade-deleted with parent).
3. **Auto-numbered `po_number`**, mirroring `ServiceIntake::boot()`: placeholder on `creating`, real `PO-00000001`-style number set via `updateQuietly()` in a `created` hook once the id exists.
4. **Status machine**: `draft → ordered → partially_received | received`, with `cancelled` reachable from `draft`/`ordered`/`partially_received` only. No skipping backwards.
5. **Inventory integration**: receiving a line item calls `InventoryLog::logChange($product, 'addition', $qty, null, "PO {$po->po_number} received", $user)` then `$product->incrementStock($qty)` — the same call shape already used for order-return restocking in `OrderController`/`AdminController`. Add a nullable `purchase_order_id` column to `inventory_logs` (parallel to the existing `order_id` column) so the ledger traces back to its PO.
6. **Expense linkage is optional/Phase 2** — do not block the MVP on it. Add a nullable `expense_id` on `purchase_orders`; only populate it if/when you wire up "mark as paid → create Expense" (category "Inventory Purchases", `reference = po_number`). No observer/automatic magic — this codebase logs everything explicitly in controllers.
7. **No FormRequest classes, no zod.** This codebase validates inline via `$request->validate([...])` in private controller helper methods (backend) and plain `useState` form objects with manual `onChange`/`required` (frontend, for anything non-trivial — the Products and Orders create/edit pages are the reference, not the simpler RHF-based Banners/FAQs pages). Match this exactly; don't introduce FormRequest or zod as a "nicer" alternative.
8. **RBAC is route-group-based, not permission-middleware-based.** Every admin route lives inside a single `Route::middleware(['role:admin'])->prefix('admin')` group with no per-route `permission:` middleware anywhere in the repo today. Just add routes inside that same group. Still add granular permission strings to `RoleSeeder.php` (snake_case, e.g. `manage_purchases`) for future-proofing and because the Roles/Permissions admin UI already manages/display them — but do not gate the routes with `permission:` middleware, since nothing else does and retrofitting that repo-wide is out of scope.
9. **Audit logging is manual.** Call `AuditLog::log($request->user(), 'create_purchase_order', 'PurchaseOrder', $po->id, null, [...], 'Purchase order created')` etc. after every mutating action (create, update, receive, cancel) — see `ServiceIntakeController` for the exact call shape.

---

## 3. Backend (`gadget-revive-api`)

### 3.1 Migrations

Create in this order (dates chosen to sort after the current latest migration, `2026_06_19_000002_create_expenses_table.php`):

**`2026_07_07_000001_create_suppliers_table.php`**
```php
Schema::create('suppliers', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('contact_person')->nullable();
    $table->string('phone')->nullable();
    $table->string('email')->nullable();
    $table->text('address')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
    $table->softDeletes();

    $table->index(['is_active']);
});
```

**`2026_07_07_000002_create_purchase_orders_table.php`**
```php
Schema::create('purchase_orders', function (Blueprint $table) {
    $table->id();
    $table->string('po_number')->unique();
    $table->foreignId('supplier_id')->constrained()->cascadeOnDelete();
    $table->enum('status', ['draft', 'ordered', 'partially_received', 'received', 'cancelled'])->default('draft');
    $table->decimal('subtotal', 12, 2)->default(0);
    $table->decimal('tax', 12, 2)->default(0);
    $table->decimal('shipping_cost', 12, 2)->default(0);
    $table->decimal('total', 12, 2)->default(0);
    $table->date('expected_date')->nullable();
    $table->timestamp('ordered_at')->nullable();
    $table->timestamp('received_at')->nullable();
    $table->timestamp('cancelled_at')->nullable();
    $table->text('notes')->nullable();
    $table->foreignId('expense_id')->nullable()->constrained('expenses')->nullOnDelete();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
    $table->softDeletes();

    $table->index(['status', 'created_at']);
});
```

**`2026_07_07_000003_create_purchase_order_items_table.php`**
```php
Schema::create('purchase_order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
    $table->foreignId('product_id')->constrained();
    $table->integer('quantity');
    $table->integer('received_qty')->default(0);
    $table->decimal('unit_cost', 12, 2);
    $table->decimal('total_cost', 12, 2);
    $table->timestamps();
});
```

**`2026_07_07_000004_add_purchase_order_id_to_inventory_logs_table.php`**
```php
Schema::table('inventory_logs', function (Blueprint $table) {
    $table->foreignId('purchase_order_id')->nullable()->after('order_id')
        ->constrained()->nullOnDelete();
});
```

### 3.2 Models

**`app/Models/Supplier.php`**
```php
class Supplier extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'contact_person', 'phone', 'email', 'address', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }
}
```

**`app/Models/PurchaseOrder.php`**
```php
class PurchaseOrder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'po_number', 'supplier_id', 'status', 'subtotal', 'tax', 'shipping_cost', 'total',
        'expected_date', 'ordered_at', 'received_at', 'cancelled_at', 'notes', 'expense_id', 'created_by',
    ];
    protected $casts = [
        'subtotal' => 'decimal:2', 'tax' => 'decimal:2', 'shipping_cost' => 'decimal:2', 'total' => 'decimal:2',
        'expected_date' => 'date', 'ordered_at' => 'datetime', 'received_at' => 'datetime', 'cancelled_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (PurchaseOrder $po) {
            if (empty($po->po_number)) {
                $po->po_number = 'PO-PENDING';
            }
        });

        static::created(function (PurchaseOrder $po) {
            if ($po->po_number === 'PO-PENDING') {
                $po->updateQuietly(['po_number' => 'PO-' . str_pad($po->id, 8, '0', STR_PAD_LEFT)]);
            }
        });
    }

    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function items(): HasMany { return $this->hasMany(PurchaseOrderItem::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function expense(): BelongsTo { return $this->belongsTo(Expense::class); }
    public function inventoryLogs(): HasMany { return $this->hasMany(InventoryLog::class); }

    public function isLocked(): bool
    {
        return in_array($this->status, ['received', 'cancelled']);
    }

    public function canReceive(): bool
    {
        return in_array($this->status, ['ordered', 'partially_received']);
    }

    public function canCancel(): bool
    {
        return in_array($this->status, ['draft', 'ordered', 'partially_received']);
    }
}
```

**`app/Models/PurchaseOrderItem.php`**
```php
class PurchaseOrderItem extends Model
{
    protected $fillable = ['purchase_order_id', 'product_id', 'quantity', 'received_qty', 'unit_cost', 'total_cost'];
    protected $casts = ['unit_cost' => 'decimal:2', 'total_cost' => 'decimal:2'];

    public function purchaseOrder(): BelongsTo { return $this->belongsTo(PurchaseOrder::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }

    public function isFullyReceived(): bool { return $this->received_qty >= $this->quantity; }
    public function remainingQty(): int { return max(0, $this->quantity - $this->received_qty); }
}
```

**Edit `app/Models/InventoryLog.php`**: add `purchase_order_id` to `$fillable`, add:
```php
public function purchaseOrder(): BelongsTo { return $this->belongsTo(PurchaseOrder::class); }
```
The existing `InventoryLog::type` enum is `['addition', 'deduction', 'adjustment', 'sale', 'return']` — reuse `'addition'` for receipts; do not add a new enum value.

### 3.3 Controller — `app/Http/Controllers/Api/PurchaseOrderController.php`

Extend `BaseController` (gives `$this->success/created/notFound/paginated/serverError/validationError`). Structure to copy from `ServiceIntakeController`:

```php
class PurchaseOrderController extends BaseController
{
    private const RELATIONS = ['supplier', 'items.product', 'creator', 'expense'];

    public function index(Request $request)
    {
        $query = PurchaseOrder::query()->with(['supplier', 'items']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }
        if ($request->filled('search')) {
            $query->where('po_number', 'like', "%{$request->search}%");
        }
        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $orders = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($orders);
    }

    public function show($id)
    {
        $po = PurchaseOrder::with(self::RELATIONS)->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        return $this->success($po);
    }

    public function store(Request $request)
    {
        $data = $this->validatePurchaseOrder($request);

        DB::beginTransaction();
        try {
            $po = PurchaseOrder::create([
                'supplier_id' => $data['supplier_id'],
                'status' => 'draft',
                'expected_date' => $data['expected_date'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $this->syncItems($po, $data['items']);
            $this->recalculateTotals($po, $data['tax'] ?? 0, $data['shipping_cost'] ?? 0);

            AuditLog::log($request->user(), 'create_purchase_order', 'PurchaseOrder', $po->id, null, $po->fresh(self::RELATIONS)->toArray(), 'Purchase order created');

            DB::commit();
            return $this->created($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create purchase order: ' . $e->getMessage());
        }
    }

    public function update(Request $request, $id)
    {
        $po = PurchaseOrder::find($id);
        if (!$po) return $this->notFound('Purchase order not found');
        if ($po->isLocked()) return $this->error('Cannot edit a received or cancelled purchase order', 422);

        $data = $this->validatePurchaseOrder($request);
        $old = $po->toArray();

        DB::beginTransaction();
        try {
            $po->update([
                'supplier_id' => $data['supplier_id'],
                'expected_date' => $data['expected_date'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $po->items()->delete();
            $this->syncItems($po, $data['items']);
            $this->recalculateTotals($po, $data['tax'] ?? 0, $data['shipping_cost'] ?? 0);

            AuditLog::log($request->user(), 'update_purchase_order', 'PurchaseOrder', $po->id, $old, $po->fresh(self::RELATIONS)->toArray(), 'Purchase order updated');

            DB::commit();
            return $this->success($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to update purchase order: ' . $e->getMessage());
        }
    }

    /** Mark as ordered (draft -> ordered), separate from full update — mirrors ServiceIntake::updateStatus() */
    public function markOrdered(Request $request, $id)
    {
        $po = PurchaseOrder::find($id);
        if (!$po) return $this->notFound('Purchase order not found');
        if ($po->status !== 'draft') return $this->error('Only draft purchase orders can be marked as ordered', 422);

        $po->update(['status' => 'ordered', 'ordered_at' => now()]);
        AuditLog::log($request->user(), 'order_purchase_order', 'PurchaseOrder', $po->id, null, null, 'Purchase order marked as ordered');

        return $this->success($po->fresh(self::RELATIONS));
    }

    /** Receive goods — full or partial, per line item. Body: { items: [{ id, received_qty }] } */
    public function receive(Request $request, $id)
    {
        $po = PurchaseOrder::with('items.product')->find($id);
        if (!$po) return $this->notFound('Purchase order not found');
        if (!$po->canReceive()) return $this->error('This purchase order cannot be received in its current status', 422);

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:purchase_order_items,id',
            'items.*.received_qty' => 'required|integer|min:0',
        ]);

        DB::beginTransaction();
        try {
            foreach ($data['items'] as $row) {
                $item = $po->items->firstWhere('id', $row['id']);
                if (!$item) continue;

                $qtyToAdd = min($row['received_qty'], $item->remainingQty());
                if ($qtyToAdd <= 0) continue;

                InventoryLog::logChange(
                    $item->product,
                    'addition',
                    $qtyToAdd,
                    null,
                    "PO {$po->po_number} received",
                    $request->user()
                )->update(['purchase_order_id' => $po->id]);

                $item->product->incrementStock($qtyToAdd);
                $item->increment('received_qty', $qtyToAdd);
            }

            $po->refresh();
            $allReceived = $po->items->every(fn ($i) => $i->isFullyReceived());
            $anyReceived = $po->items->contains(fn ($i) => $i->received_qty > 0);

            $po->update([
                'status' => $allReceived ? 'received' : ($anyReceived ? 'partially_received' : $po->status),
                'received_at' => $allReceived ? now() : $po->received_at,
            ]);

            AuditLog::log($request->user(), 'receive_purchase_order', 'PurchaseOrder', $po->id, null, $data, 'Purchase order goods received');

            DB::commit();
            return $this->success($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to receive purchase order: ' . $e->getMessage());
        }
    }

    public function cancel(Request $request, $id)
    {
        $po = PurchaseOrder::find($id);
        if (!$po) return $this->notFound('Purchase order not found');
        if (!$po->canCancel()) return $this->error('This purchase order cannot be cancelled in its current status', 422);

        $po->update(['status' => 'cancelled', 'cancelled_at' => now()]);
        AuditLog::log($request->user(), 'cancel_purchase_order', 'PurchaseOrder', $po->id, null, null, 'Purchase order cancelled');

        return $this->success($po->fresh(self::RELATIONS));
    }

    public function destroy(Request $request, $id)
    {
        $po = PurchaseOrder::find($id);
        if (!$po) return $this->notFound('Purchase order not found');
        if ($po->status !== 'draft') return $this->error('Only draft purchase orders can be deleted', 422);

        $po->delete();
        AuditLog::log($request->user(), 'delete_purchase_order', 'PurchaseOrder', $id, null, null, 'Purchase order deleted');

        return $this->noContent('Purchase order deleted');
    }

    // --- private helpers ---

    private function validatePurchaseOrder(Request $request): array
    {
        return $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'expected_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'tax' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
        ]);
    }

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        foreach ($items as $row) {
            $po->items()->create([
                'product_id' => $row['product_id'],
                'quantity' => $row['quantity'],
                'unit_cost' => $row['unit_cost'],
                'total_cost' => $row['quantity'] * $row['unit_cost'],
            ]);
        }
    }

    private function recalculateTotals(PurchaseOrder $po, float $tax, float $shipping): void
    {
        $subtotal = $po->items()->sum('total_cost');
        $po->update([
            'subtotal' => $subtotal,
            'tax' => $tax,
            'shipping_cost' => $shipping,
            'total' => $subtotal + $tax + $shipping,
        ]);
    }
}
```

> Note: `InventoryLog::logChange(...)` as it exists today returns the created log but does not accept `purchase_order_id` — the `->update(['purchase_order_id' => $po->id])` call above is a pragmatic two-step (create via existing helper, then set the new FK) rather than modifying the shared helper's signature and risking breaking its other callers (`OrderController`, `AdminController`). If you prefer, extend `logChange()`'s signature with an optional `?int $purchaseOrderId = null` param instead — either is acceptable, just be consistent.

### 3.4 Controller — `app/Http/Controllers/Api/SupplierController.php`

Simple CRUD, same shape as `ExpenseCategoryController`-style methods inside `ExpenseController`:

```php
class SupplierController extends BaseController
{
    public function index(Request $request)
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

    public function store(Request $request)
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

    public function show($id)
    {
        $supplier = Supplier::find($id);
        if (!$supplier) return $this->notFound('Supplier not found');
        return $this->success($supplier);
    }

    public function update(Request $request, $id)
    {
        $supplier = Supplier::find($id);
        if (!$supplier) return $this->notFound('Supplier not found');
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

    public function destroy(Request $request, $id)
    {
        $supplier = Supplier::withCount('purchaseOrders')->find($id);
        if (!$supplier) return $this->notFound('Supplier not found');
        if ($supplier->purchase_orders_count > 0) {
            return $this->error('Cannot delete a supplier that has purchase orders', 422);
        }
        $supplier->delete();
        AuditLog::log($request->user(), 'delete_supplier', 'Supplier', $id, null, null, 'Supplier deleted');
        return $this->noContent('Supplier deleted');
    }
}
```

### 3.5 Routes — `routes/api.php`

Add inside the existing `Route::middleware(['role:admin'])->prefix('admin')->group(function () { ... })` block (near where `expenses`/`service-intakes` are registered):

```php
Route::prefix('suppliers')->group(function () {
    Route::get('/', [SupplierController::class, 'index']);
    Route::post('/', [SupplierController::class, 'store']);
    Route::get('/{id}', [SupplierController::class, 'show']);
    Route::put('/{id}', [SupplierController::class, 'update']);
    Route::delete('/{id}', [SupplierController::class, 'destroy']);
});

Route::prefix('purchases')->group(function () {
    Route::get('/', [PurchaseOrderController::class, 'index']);
    Route::post('/', [PurchaseOrderController::class, 'store']);
    Route::get('/{id}', [PurchaseOrderController::class, 'show']);
    Route::put('/{id}', [PurchaseOrderController::class, 'update']);
    Route::delete('/{id}', [PurchaseOrderController::class, 'destroy']);
    Route::post('/{id}/mark-ordered', [PurchaseOrderController::class, 'markOrdered']);
    Route::post('/{id}/receive', [PurchaseOrderController::class, 'receive']);
    Route::post('/{id}/cancel', [PurchaseOrderController::class, 'cancel']);
    Route::get('/{id}/download', [PurchaseOrderController::class, 'downloadPdf']);
});
```

Don't forget the `use` imports for `SupplierController` and `PurchaseOrderController` at the top of `routes/api.php`.

### 3.6 RBAC — `database/seeders/RoleSeeder.php`

Add to the `$permissions` array (snake_case, matching existing convention):
```php
'manage_purchases', 'view_purchases', 'manage_suppliers',
```
`admin` role already gets `Permission::all()`, so no further change needed there. These won't be route-enforced (see design decision #8) but will show up correctly in the existing Roles/Permissions admin UI.

### 3.7 PDF (optional but recommended, mirrors ServiceIntake receipts)

Add `resources/views/invoices/purchase-order.blade.php` (copy structure/styling from `resources/views/invoices/service-receipt.blade.php`, swap in PO fields: supplier info, line items with unit cost/qty/total, grand total). Add to `PurchaseOrderController`:
```php
public function downloadPdf($id)
{
    $po = PurchaseOrder::with(self::RELATIONS)->findOrFail($id);
    $pdf = Pdf::loadView('invoices.purchase-order', ['po' => $po, 'settings' => $this->brandingSettings()])
        ->setPaper('A4', 'portrait')
        ->setOptions(['defaultFont' => 'DejaVu Sans', 'isRemoteEnabled' => false]);
    return $pdf->download("{$po->po_number}.pdf");
}
```
(Use the `ResolvesBrandingSettings` trait like `ServiceIntakeController` does, if you want the company logo/name on the PDF.)

---

## 4. Frontend (`gadget-revive-admin`)

Mirror the **Orders module** (`src/app/orders/`) since a Purchase Order is structurally a sales order inverted (supplier instead of customer, receiving instead of shipping). Use plain `useState` form state (not react-hook-form/zod) to match the Products/Orders convention.

### 4.1 Types — add to `src/types/index.ts`

```ts
export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  received_qty: number;
  unit_cost: number | string;
  total_cost: number | string;
  product?: Product;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  subtotal: number | string;
  tax: number | string;
  shipping_cost: number | string;
  total: number | string;
  expected_date?: string | null;
  ordered_at?: string | null;
  received_at?: string | null;
  cancelled_at?: string | null;
  notes?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  creator?: { id: number; name: string };
}
```

### 4.2 `adminService` — add to `src/lib/adminService.ts`

Append onto the existing flat `adminService` object (do **not** create a separate file):

```ts
// Suppliers
getSuppliers: (params?: ListParams) => api.get<{ data: PaginatedResponse<Supplier> }>('/admin/suppliers', { params }),
getSupplier: (id: number) => api.get<ApiResponse<Supplier>>(`/admin/suppliers/${id}`),
createSupplier: (data: Record<string, unknown>) => api.post<ApiResponse<Supplier>>('/admin/suppliers', data),
updateSupplier: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Supplier>>(`/admin/suppliers/${id}`, data),
deleteSupplier: (id: number) => api.delete(`/admin/suppliers/${id}`),

// Purchase Orders
getPurchases: (params?: ListParams) => api.get<{ data: PaginatedResponse<PurchaseOrder> }>('/admin/purchases', { params }),
getPurchase: (id: number) => api.get<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}`),
createPurchase: (data: Record<string, unknown>) => api.post<ApiResponse<PurchaseOrder>>('/admin/purchases', data),
updatePurchase: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}`, data),
deletePurchase: (id: number) => api.delete(`/admin/purchases/${id}`),
markPurchaseOrdered: (id: number) => api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/mark-ordered`),
receivePurchase: (id: number, data: { items: { id: number; received_qty: number }[] }) =>
  api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/receive`, data),
cancelPurchase: (id: number) => api.post<ApiResponse<PurchaseOrder>>(`/admin/purchases/${id}/cancel`),
purchaseDownloadUrl: (id: number) => `${API_URL}/admin/purchases/${id}/download`,
```

Import `Supplier`, `PurchaseOrder` types at the top of the file alongside the other type imports.

### 4.3 Pages

**`src/app/suppliers/page.tsx`** — simple list+modal CRUD (copy `src/app/expenses/page.tsx` structure almost verbatim: hand-rolled `<table>`, `Modal` for create/edit form, `ConfirmModal` for delete, search input, `is_active` filter as a tab-strip or `Select`).

**`src/app/purchases/page.tsx`** — list page (copy `src/app/orders/page.tsx` structure):
- Filters: status tab-strip (`draft`/`ordered`/`partially_received`/`received`/`cancelled`, with counts), supplier `SearchableSelect` filter, date range, search by `po_number`.
- Table columns: PO Number, Supplier, Status (`Badge` with variant mapped per status — e.g. `draft`→`default`, `ordered`→`info`, `partially_received`→`warning`, `received`→`success`, `cancelled`→`danger`), Total, Expected Date, Created, Actions (View / Edit if draft / Cancel if cancellable).
- `Pagination` component at the bottom, `EmptyState`/`ErrorState` for empty/error cases.

**`src/app/purchases/create/page.tsx`** — form page (copy `src/app/orders/create/page.tsx` line-item-builder pattern):
- Main column (`lg:col-span-2`): Supplier `SearchableSelect` (fed by `adminService.getSuppliers({ per_page: 1000, is_active: true })`), a product search/add-line-item flow (reuse or adapt the `ItemSearchModal` pattern from Orders — search products, add to a local line-items array with `quantity` + `unit_cost` editable inline), a running line-items table with remove buttons.
- Sidebar column (`lg:col-span-1`): expected date picker, tax/shipping inputs, computed subtotal/total (derived from line items — recompute client-side as items change, don't trust stale totals), notes textarea, Submit button (`isLoading` state on `Button` while posting).
- On submit: build `{ supplier_id, expected_date, notes, tax, shipping_cost, items: [{product_id, quantity, unit_cost}] }`, call `adminService.createPurchase(payload)`, `toast.success` + `router.push('/purchases')` on success, `toast.error(getErrorMessage(err))` on failure.

**`src/app/purchases/[id]/edit/page.tsx`** — same form, pre-filled via `adminService.getPurchase(id)`, only reachable/enabled while `status === 'draft'` (redirect or disable form otherwise, matching backend's `isLocked()` guard).

**`src/app/purchases/[id]/page.tsx`** — detail page (copy `src/app/orders/[id]/page.tsx` structure):
- Header: PO number, status `Badge`, supplier info card, dates.
- Line items table: Product, Ordered Qty, Received Qty, Unit Cost, Total — show a progress indicator per line (`received_qty / quantity`).
- Totals card: subtotal / tax / shipping / total.
- Actions (conditionally rendered per `status`, matching backend guards):
  - `draft` → "Mark as Ordered" button (`adminService.markPurchaseOrdered`), "Edit" link, "Delete" (`ConfirmModal`).
  - `ordered` / `partially_received` → "Receive Goods" button opening a `Modal` with an input per remaining line item (`remaining = quantity - received_qty`, default input value = remaining, editable down to partial), submits via `adminService.receivePurchase(id, { items })`.
  - `ordered` / `partially_received` / `draft` → "Cancel" button (`ConfirmModal`, variant `danger`).
  - Any non-`draft` status → "Download PDF" link to `adminService.purchaseDownloadUrl(id)`.
  - `received` / `cancelled` → no mutating actions, read-only.

### 4.4 Sidebar — `src/components/layout/Sidebar.tsx`

Add a new nav group (same shape as the existing `Expenses` group), positioned near Products/Vendors:
```tsx
{
  title: 'Purchases',
  icon: <ShoppingBag className="w-5 h-5" />, // or another lucide-react icon not already used
  children: [
    { title: 'All Purchase Orders', href: '/purchases' },
    { title: 'Create Purchase Order', href: '/purchases/create' },
    { title: 'Suppliers', href: '/suppliers' },
  ],
},
```
(Check `lucide-react` for an appropriate icon — `ShoppingBag`, `PackagePlus`, or `Truck` are reasonable choices not already used elsewhere in the sidebar.)

No RBAC/permission-gating needed on this nav item — confirmed the sidebar doesn't gate anything by permission anywhere else today.

---

## 5. Business rules checklist (for review/QA once implemented)

- [ ] A PO cannot be edited once `received` or `cancelled`.
- [ ] A PO can only be deleted while `draft`.
- [ ] Receiving is idempotent per line item — re-submitting the same `received_qty` twice should not double-count stock (backend clamps `qtyToAdd = min(received_qty, remainingQty())`, and only adds the *delta* requested in that specific request — the frontend modal should always default to showing the *remaining* qty, not resend already-received quantities).
- [ ] Receiving a line fully moves that line's contribution; PO status only flips to `received` when **every** line is fully received, otherwise `partially_received`.
- [ ] Cancelling a PO does **not** reverse any already-received stock (received goods are already physically in the warehouse — this mirrors real-world procurement; don't auto-decrement stock on cancel).
- [ ] Every stock increase from a PO produces a traceable `InventoryLog` row with `purchase_order_id` set, visible from the existing inventory log views/reports.
- [ ] Supplier cannot be deleted while it has purchase orders (soft-delete-safe check via `withCount`).

---

## 6. Suggested implementation order

1. Backend: migrations → models → `SupplierController` + routes → verify via `php artisan tinker`/Postman.
2. Backend: `PurchaseOrderController` (index/store/show/update/destroy) → routes → verify CRUD.
3. Backend: `receive()` + `markOrdered()` + `cancel()` actions → manually verify stock updates and `InventoryLog` rows.
4. Backend: RBAC permission strings in `RoleSeeder` (run `php artisan db:seed --class=RoleSeeder` or re-run full seed on a fresh DB).
5. Backend: PDF (optional, can ship without it).
6. Frontend: types + `adminService` methods.
7. Frontend: `suppliers/page.tsx` (simplest, unblocks supplier picker).
8. Frontend: `purchases/page.tsx` (list) → `purchases/create/page.tsx` → `purchases/[id]/page.tsx` (detail + receive/cancel actions) → `purchases/[id]/edit/page.tsx`.
9. Frontend: Sidebar nav entry.
10. End-to-end manual test: create supplier → create draft PO → mark ordered → partially receive → fully receive → confirm `products.stock_qty` and `inventory_logs` reflect it → confirm audit log entries exist for each step.
