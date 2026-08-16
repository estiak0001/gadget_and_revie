<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\InventoryLog;
use App\Models\JournalEntry;
use App\Models\ProductSerial;
use App\Models\PurchaseOrder;
use App\Traits\ResolvesBrandingSettings;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends BaseController
{
    use ResolvesBrandingSettings;

    private const RELATIONS = ['supplier', 'items.product', 'items.serials', 'creator', 'expense', 'order'];

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::query()->with(['supplier', 'items', 'creator:id,name']);

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
        if ($request->filled('payment_status')) {
            // received_value isn't a stored column (it's derived from item lines),
            // so payment status is filtered via a correlated subquery. Mirrors
            // PurchaseOrder::getPaymentStatusAttribute() exactly.
            $receivedValueSql = '(SELECT COALESCE(SUM(poi.received_qty * poi.unit_cost), 0) '
                . 'FROM purchase_order_items poi WHERE poi.purchase_order_id = purchase_orders.id)';

            match ($request->payment_status) {
                'unpaid' => $query->where('paid_amount', '<=', 0),
                'partial' => $query->whereRaw("paid_amount > 0 AND {$receivedValueSql} > 0 AND paid_amount < {$receivedValueSql}"),
                'paid' => $query->whereRaw("paid_amount > 0 AND ({$receivedValueSql} <= 0 OR paid_amount >= {$receivedValueSql})"),
                default => null,
            };
        }
        if ($request->boolean('has_returns')) {
            // "Returned" isn't a value `status` can hold (a PO can be received/partially_received
            // *and* have some of its items sent back) — so filtering by "has this PO had any
            // returns" has to go through the item lines rather than the status column.
            $query->whereHas('items', fn ($q) => $q->where('returned_qty', '>', 0));
        }

        $orders = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($orders);
    }

    /**
     * Every purchase-order line that's ever brought a given product in, across every supplier —
     * unit cost, quantities, and the actual serial numbers received in each batch. Used by the
     * Purchase History page's "By Product" tab, alongside the existing supplier_id filter on
     * index() for its "By Supplier" tab.
     */
    public function productHistory(Request $request): JsonResponse
    {
        $data = $request->validate(['product_id' => 'required|exists:products,id']);

        $product = \App\Models\Product::findOrFail($data['product_id']);

        $items = \App\Models\PurchaseOrderItem::where('product_id', $product->id)
            ->with([
                'purchaseOrder:id,po_number,supplier_id,status,created_at',
                'purchaseOrder.supplier:id,name',
                // A purchase order can carry multiple products, and each product line its own set of
                // serials — these are already scoped per purchase_order_item above, so each batch only
                // ever shows the serials that actually belong to it. Each serial is then traced forward
                // to whichever sale (order) consumed it, if any, so "purchased in batch X" and "sold on
                // invoice Y" can both be seen from the same row.
                'serials:id,purchase_order_item_id,serial_number,status,order_item_id',
                'serials.orderItem:id,order_id',
                'serials.orderItem.order:id,order_number,customer_name,created_at',
            ])
            ->whereHas('purchaseOrder')
            ->get()
            ->sortByDesc(fn ($item) => $item->purchaseOrder->created_at)
            ->values();

        $summary = [
            'total_purchase_orders' => $items->pluck('purchase_order_id')->unique()->count(),
            'total_quantity_ordered' => (int) $items->sum('quantity'),
            'total_quantity_received' => (int) $items->sum('received_qty'),
            'total_spent' => round((float) $items->sum(fn ($i) => $i->received_qty * $i->unit_cost), 2),
            'avg_unit_cost' => $items->count() > 0 ? round((float) $items->avg('unit_cost'), 2) : 0,
            'last_purchase_date' => $items->first()?->purchaseOrder?->created_at?->toDateString(),
        ];

        return $this->success([
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'current_cost' => $product->current_cost,
                'stock_qty' => $product->stock_qty,
                // Product's own default warranty policy — separate from each batch's own
                // warranty_value/warranty_unit below, which is what the supplier actually
                // committed to for that specific purchase (can differ batch to batch).
                'warranty_value' => $product->warranty_value,
                'warranty_unit' => $product->warranty_unit,
                // The DB column is still named `warranty` (free-text) — relabeled "Warranty Notes"
                // everywhere it's shown, matching ProductResource's own field mapping.
                'warranty_note' => $product->warranty,
            ],
            'items' => $items->map(fn ($item) => [
                'id' => $item->id,
                'po_id' => $item->purchase_order_id,
                'po_number' => $item->purchaseOrder->po_number,
                'po_status' => $item->purchaseOrder->status,
                'date' => $item->purchaseOrder->created_at->toDateString(),
                'supplier' => $item->purchaseOrder->supplier ? [
                    'id' => $item->purchaseOrder->supplier->id,
                    'name' => $item->purchaseOrder->supplier->name,
                ] : null,
                'quantity' => $item->quantity,
                'received_qty' => $item->received_qty,
                'returned_qty' => $item->returned_qty,
                'unit_cost' => $item->unit_cost,
                'total_cost' => $item->total_cost,
                'warranty_value' => $item->warranty_value,
                'warranty_unit' => $item->warranty_unit,
                'serials' => $item->serials->map(fn ($serial) => [
                    'serial_number' => $serial->serial_number,
                    'status' => $serial->status,
                    'sold' => $serial->orderItem?->order ? [
                        'order_id' => $serial->orderItem->order->id,
                        'order_number' => $serial->orderItem->order->order_number,
                        'customer_name' => $serial->orderItem->order->customer_name,
                        'sold_at' => $serial->orderItem->order->created_at->toDateString(),
                    ] : null,
                ])->values(),
            ]),
            'summary' => $summary,
        ]);
    }

    /**
     * Look up one unit by its serial number — which batch/supplier/PO brought it in, its warranty,
     * and (if applicable) which order/invoice it was sold on. `serial_number` is unique per product
     * but not globally, so a search can legitimately return more than one match (e.g. two different
     * products that happen to share a serial string); every match is returned, newest first.
     */
    public function serialHistory(Request $request): JsonResponse
    {
        $data = $request->validate(['serial_number' => 'required|string|min:2|max:255']);

        $serials = ProductSerial::where('serial_number', 'like', '%' . $data['serial_number'] . '%')
            ->with([
                // The DB column is still named `warranty` (free-text) — mapped to `warranty_note`
                // below, matching ProductResource's own field mapping.
                'product:id,name,sku,warranty_value,warranty_unit,warranty',
                'purchaseOrderItem:id,purchase_order_id,unit_cost,warranty_value,warranty_unit',
                'purchaseOrderItem.purchaseOrder:id,po_number,supplier_id,status,created_at',
                'purchaseOrderItem.purchaseOrder.supplier:id,name',
                'orderItem:id,order_id',
                'orderItem.order:id,order_number,customer_name,created_at',
            ])
            ->latest('id')
            ->limit(50)
            ->get();

        return $this->success($serials->map(fn ($serial) => [
            'serial_number' => $serial->serial_number,
            'status' => $serial->status,
            'product' => $serial->product ? [
                'id' => $serial->product->id,
                'name' => $serial->product->name,
                'sku' => $serial->product->sku,
                'warranty_value' => $serial->product->warranty_value,
                'warranty_unit' => $serial->product->warranty_unit,
                'warranty_note' => $serial->product->warranty,
            ] : null,
            'purchase' => $serial->purchaseOrderItem?->purchaseOrder ? [
                'po_id' => $serial->purchaseOrderItem->purchaseOrder->id,
                'po_number' => $serial->purchaseOrderItem->purchaseOrder->po_number,
                'supplier' => $serial->purchaseOrderItem->purchaseOrder->supplier ? [
                    'id' => $serial->purchaseOrderItem->purchaseOrder->supplier->id,
                    'name' => $serial->purchaseOrderItem->purchaseOrder->supplier->name,
                ] : null,
                'date' => $serial->purchaseOrderItem->purchaseOrder->created_at->toDateString(),
                'unit_cost' => $serial->purchaseOrderItem->unit_cost,
                'warranty_value' => $serial->purchaseOrderItem->warranty_value,
                'warranty_unit' => $serial->purchaseOrderItem->warranty_unit,
            ] : null,
            'sold' => $serial->orderItem?->order ? [
                'order_id' => $serial->orderItem->order->id,
                'order_number' => $serial->orderItem->order->order_number,
                'customer_name' => $serial->orderItem->order->customer_name,
                'sold_at' => $serial->orderItem->order->created_at->toDateString(),
            ] : null,
        ]), 'Serial history retrieved successfully');
    }

    public function show(int $id): JsonResponse
    {
        $po = PurchaseOrder::with(self::RELATIONS)->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }

        return $this->success($po);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePurchaseOrder($request);

        DB::beginTransaction();
        try {
            $po = PurchaseOrder::create([
                'supplier_id' => $data['supplier_id'],
                'order_id' => $data['order_id'] ?? null,
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

    public function update(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if ($po->isLocked()) {
            return $this->error('Cannot edit a received or cancelled purchase order', 422);
        }

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

    public function destroy(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('supplier:id,name')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if ($po->status !== 'draft') {
            return $this->error('Only draft purchase orders can be deleted', 422);
        }

        // Snapshot before deleting — draft POs never carried inventory/financial impact, but the
        // record itself (po_number, supplier, what was on it) is still worth keeping for the
        // delete history, not just a bare numeric id and "deleted" with no other detail.
        $snapshot = $po->toArray();

        $po->delete();

        AuditLog::log($request->user(), 'delete_purchase_order', 'PurchaseOrder', $id, $snapshot, null, "Purchase order {$po->po_number} deleted");

        return $this->noContent('Purchase order deleted');
    }

    /** Mark as ordered (draft -> ordered), separate from full update — mirrors ServiceIntake::updateStatus() */
    public function markOrdered(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if ($po->status !== 'draft') {
            return $this->error('Only draft purchase orders can be marked as ordered', 422);
        }

        $po->update(['status' => 'ordered', 'ordered_at' => now()]);

        AuditLog::log($request->user(), 'order_purchase_order', 'PurchaseOrder', $po->id, null, null, 'Purchase order marked as ordered');

        return $this->success($po->fresh(self::RELATIONS));
    }

    /** Receive goods — full or partial, per line item. Body: { items: [{ id, received_qty }] } */
    public function receive(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('items.product')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if (!$po->canReceive()) {
            return $this->error('This purchase order cannot be received in its current status', 422);
        }

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:purchase_order_items,id',
            'items.*.received_qty' => 'required|integer|min:0',
            // Serial numbers are optional per item — not every product is individually
            // serialized (bulk parts, cables, etc.), so admins can leave this empty.
            'items.*.serials' => 'nullable|array',
            'items.*.serials.*' => 'nullable|string|max:191',
        ]);

        // Validate serials up front, before anything is mutated, so a bad entry (too many
        // serials for the quantity, or a duplicate) fails cleanly with nothing half-applied.
        $seenInRequest = [];
        foreach ($data['items'] as $row) {
            $item = $po->items->firstWhere('id', $row['id']);
            if (!$item) {
                continue;
            }
            $qtyToAdd = min($row['received_qty'], $item->remainingQty());
            $serials = array_values(array_filter(array_map('trim', $row['serials'] ?? [])));
            if (count($serials) === 0) {
                continue;
            }
            if (count($serials) > $qtyToAdd) {
                return $this->error("Entered " . count($serials) . " serial numbers but only {$qtyToAdd} units are being received for {$item->product->name}.", 422);
            }
            foreach ($serials as $serial) {
                $key = $item->product_id . '|' . $serial;
                if (isset($seenInRequest[$key])) {
                    return $this->error("Serial number \"{$serial}\" was entered more than once.", 422);
                }
                $seenInRequest[$key] = true;

                if (ProductSerial::where('product_id', $item->product_id)->where('serial_number', $serial)->exists()) {
                    return $this->error("Serial number \"{$serial}\" already exists for {$item->product->name}.", 422);
                }
            }
        }

        DB::beginTransaction();
        try {
            $receivedValue = 0;

            foreach ($data['items'] as $row) {
                $item = $po->items->firstWhere('id', $row['id']);
                if (!$item) {
                    continue;
                }

                $qtyToAdd = min($row['received_qty'], $item->remainingQty());
                if ($qtyToAdd <= 0) {
                    continue;
                }

                InventoryLog::logChange(
                    $item->product,
                    'addition',
                    $qtyToAdd,
                    null,
                    "PO {$po->po_number} received",
                    $request->user()
                )->update(['purchase_order_id' => $po->id]);

                // Must run before incrementStock() — the weighted-average math needs stock_qty
                // as it stood immediately before this receipt.
                $item->product->recordPurchaseReceipt($qtyToAdd, (float) $item->unit_cost);
                $item->product->incrementStock($qtyToAdd);
                $item->increment('received_qty', $qtyToAdd);

                $serials = array_values(array_filter(array_map('trim', $row['serials'] ?? [])));
                foreach ($serials as $serial) {
                    $item->serials()->create([
                        'product_id' => $item->product_id,
                        'serial_number' => $serial,
                        'status' => 'in_stock',
                        'added_by' => $request->user()->id,
                    ]);
                }

                $receivedValue += $qtyToAdd * $item->unit_cost;
            }

            if ($receivedValue > 0) {
                $po->postReceiptJournalEntry($receivedValue, $request->user());
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

    /**
     * Return received goods to the supplier — allowed at any point after anything's been
     * received, including on an already-'received' PO (deliberately not gated by canReceive()/
     * isLocked(); this is a separate, additive action, not "unlock editing"). Hard-blocks
     * returning a unit that's currently sold to a customer — that must be returned/refunded from
     * the order first, which frees it back to 'in_stock' and makes it eligible here.
     * Body: { items: [{ id, quantity, serials?, reason? }] }
     */
    public function returnToSupplier(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('items.product')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:purchase_order_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.serials' => 'nullable|array',
            'items.*.serials.*' => 'nullable|string|max:191',
            'items.*.reason' => 'nullable|string|max:255',
            // Set when the admin confirms the supplier handed the refund back in cash in the same
            // moment as this return (e.g. an in-person exchange) — routes the "already paid for"
            // portion straight to Cash instead of parking it in Accounts Receivable. See the
            // $againstPaid branch below.
            'collect_refund_now' => 'sometimes|boolean',
        ]);
        $collectRefundNow = (bool) ($data['collect_refund_now'] ?? false);

        // Resolve up front, before anything is mutated, so a bad row (nothing left to return, or
        // some of it currently sold) fails cleanly with nothing half-applied. Also decides which
        // specific serials go back for each row — either the ones the admin named, or the oldest
        // still-in-stock ones from this batch if they didn't (non-serialized lines have none).
        $resolved = [];
        foreach ($data['items'] as $row) {
            $item = $po->items->firstWhere('id', $row['id']);
            // The `exists:purchase_order_items,id` rule above only proves this id exists
            // *somewhere*, not that it belongs to this PO — without this check a stray/mismatched
            // id would silently no-op below, yet the request would still report success and log
            // "goods returned to supplier" even though nothing actually moved.
            if (!$item) {
                return $this->error("Line item #{$row['id']} does not belong to this purchase order.", 422);
            }
            if ($item->received_qty <= 0) {
                return $this->error("Nothing has been received yet for {$item->product->name} — there's nothing to return.", 422);
            }

            $qty = $row['quantity'];
            $returnable = $item->returnableQty();
            if ($qty > $returnable) {
                return $this->error("Only {$returnable} unit(s) of {$item->product->name} from this line are eligible to return (already returned, or never received that many).", 422);
            }

            $namedSerials = array_values(array_filter(array_map('trim', $row['serials'] ?? [])));
            $batchIsSerialized = ProductSerial::where('purchase_order_item_id', $item->id)->exists();

            // Defense in depth: per-serial status is the primary guard below (a specific unit
            // must be `in_stock` to go back), but it can only ever be as reliable as every code
            // path that sells a serial actually keeps it in sync with the product's aggregate
            // stock_qty. Confirmed in production that at least one such path didn't (a manual
            // order that decremented stock_qty without marking any specific serial `sold`),
            // which let an already-sold unit's serial still read `in_stock` and pass the check
            // below. Cross-checking the aggregate here catches that class of bug even if a future
            // one reintroduces it, not just this specific instance of it.
            if ($item->product->stock_qty < $qty) {
                return $this->error("Only {$item->product->stock_qty} unit(s) of {$item->product->name} show as currently in stock — the rest have likely been sold. Process the relevant order return first, then return here.", 422);
            }

            $serialsToReturn = collect();
            if ($batchIsSerialized) {
                if (count($namedSerials) > 0) {
                    if (count($namedSerials) !== $qty) {
                        return $this->error("Named " . count($namedSerials) . " serial numbers but the quantity to return is {$qty} for {$item->product->name}.", 422);
                    }
                    foreach ($namedSerials as $serial) {
                        $ps = ProductSerial::where('purchase_order_item_id', $item->id)->where('serial_number', $serial)->first();
                        if (!$ps) {
                            return $this->error("Serial number \"{$serial}\" wasn't received under this line.", 422);
                        }
                        if ($ps->status !== 'in_stock') {
                            $blockedBy = $this->describeUnreturnable($ps);
                            return $this->error("Serial \"{$serial}\" is currently {$ps->status}{$blockedBy} — it can't be returned to the supplier until it's back in stock.", 422);
                        }
                        $serialsToReturn->push($ps);
                    }
                } else {
                    $available = ProductSerial::where('purchase_order_item_id', $item->id)->where('status', 'in_stock')->oldest('id')->get();
                    if ($available->count() < $qty) {
                        $soldOnes = ProductSerial::where('purchase_order_item_id', $item->id)->where('status', 'sold')
                            ->with('orderItem.order')->get();
                        $orderNumbers = $soldOnes->map(fn ($s) => $s->orderItem?->order?->order_number)->filter()->unique()->values();
                        $hint = $orderNumbers->isNotEmpty()
                            ? ' Currently sold on order ' . $orderNumbers->implode(', ') . ' — process a return/refund there first, then return here.'
                            : ' The rest have likely been sold — process the relevant order return first, then return here.';
                        return $this->error("Only {$available->count()} of {$qty} requested units of {$item->product->name} are currently in stock.{$hint}", 422);
                    }
                    $serialsToReturn = $available->take($qty);
                }
            }
            // Not individually serialized: the aggregate check above is already the only guard
            // this line needs — stock_qty nets sold vs on-hand directly, with no per-serial
            // status to cross-check against.

            $resolved[] = ['item' => $item, 'qty' => $qty, 'serials' => $serialsToReturn, 'reason' => $row['reason'] ?? null];
        }

        $outstandingBefore = $po->outstanding_payable;

        DB::beginTransaction();
        try {
            $returnedValue = 0;
            // Declared here (not just inside the `if` below) so the audit-log line after it can
            // safely reference it even in the never-actually-happens case of $returnedValue <= 0.
            $againstPaid = 0;

            foreach ($resolved as $row) {
                /** @var \App\Models\PurchaseOrderItem $item */
                $item = $row['item'];
                $qty = $row['qty'];

                InventoryLog::logChange(
                    $item->product,
                    'return_to_supplier',
                    $qty,
                    null,
                    $row['reason'] ?? "Returned to supplier via {$po->po_number}",
                    $request->user()
                )->update(['purchase_order_id' => $po->id]);

                $item->product->decrementStock($qty);
                $item->increment('returned_qty', $qty);

                foreach ($row['serials'] as $serial) {
                    $serial->update(['status' => 'returned']);
                }

                $returnedValue += $qty * $item->unit_cost;
            }

            if ($returnedValue > 0) {
                $againstUnpaid = min($returnedValue, $outstandingBefore);
                $againstPaid = round($returnedValue - $againstUnpaid, 2);

                if ($againstUnpaid > 0) {
                    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Return to supplier: {$po->po_number}", [
                        ['account_code' => '2000', 'debit' => $againstUnpaid],
                        ['account_code' => '1020', 'credit' => $againstUnpaid],
                    ], $request->user());
                }
                if ($againstPaid > 0) {
                    if ($collectRefundNow) {
                        // The PO was already fully paid, and the admin confirmed the supplier
                        // handed this refund back in cash right now — post straight to Cash
                        // instead of parking it in Accounts Receivable, and track it via
                        // refund_received_amount so refund_due_from_supplier correctly stops
                        // counting this portion as still outstanding.
                        JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Refund collected from supplier: {$po->po_number}", [
                            ['account_code' => '1000', 'debit' => $againstPaid],
                            ['account_code' => '1020', 'credit' => $againstPaid],
                        ], $request->user());
                        $po->increment('refund_received_amount', $againstPaid);
                    } else {
                        JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Refund due from supplier: {$po->po_number}", [
                            ['account_code' => '1010', 'debit' => $againstPaid],
                            ['account_code' => '1020', 'credit' => $againstPaid],
                        ], $request->user());
                    }
                }
            }

            AuditLog::log(
                $request->user(),
                'return_purchase_order_items',
                'PurchaseOrder',
                $po->id,
                null,
                $data,
                "Goods returned to supplier on {$po->po_number}" . ($collectRefundNow && $againstPaid > 0
                    ? " (refund of {$againstPaid} collected in cash)"
                    : '')
            );

            DB::commit();
            return $this->success($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to return goods to supplier: ' . $e->getMessage());
        }
    }

    /**
     * Undo some or all of a prior return-to-supplier — the unit(s) never actually left, or came
     * back, or the return was logged in error. The inverse of returnToSupplier(): pulls stock
     * back in, flips the named/auto-picked serials from `returned` back to `in_stock` (does NOT
     * re-link them to whatever order they may have originally been sold on — that's a separate,
     * deliberate step via Edit Order, since this method has no reliable way to know that's even
     * still the right order), and posts a mirrored reversing journal entry.
     */
    public function restockReturn(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('items.product')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:purchase_order_items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.serials' => 'nullable|array',
            'items.*.serials.*' => 'nullable|string|max:191',
            'items.*.reason' => 'nullable|string|max:255',
        ]);

        $resolved = [];
        foreach ($data['items'] as $row) {
            $item = $po->items->firstWhere('id', $row['id']);
            if (!$item) {
                return $this->error("Line item #{$row['id']} does not belong to this purchase order.", 422);
            }

            $qty = $row['quantity'];
            if ($qty > $item->returned_qty) {
                return $this->error("Only {$item->returned_qty} unit(s) of {$item->product->name} were ever returned to the supplier on this line — can't restock more than that.", 422);
            }

            $namedSerials = array_values(array_filter(array_map('trim', $row['serials'] ?? [])));
            $batchIsSerialized = ProductSerial::where('purchase_order_item_id', $item->id)->exists();

            $serialsToRestock = collect();
            if ($batchIsSerialized) {
                if (count($namedSerials) > 0) {
                    if (count($namedSerials) !== $qty) {
                        return $this->error("Named " . count($namedSerials) . " serial numbers but the quantity to restock is {$qty} for {$item->product->name}.", 422);
                    }
                    foreach ($namedSerials as $serial) {
                        $ps = ProductSerial::where('purchase_order_item_id', $item->id)->where('serial_number', $serial)->first();
                        if (!$ps) {
                            return $this->error("Serial number \"{$serial}\" wasn't received under this line.", 422);
                        }
                        if ($ps->status !== 'returned') {
                            return $this->error("Serial \"{$serial}\" is currently {$ps->status}, not returned — nothing to restock.", 422);
                        }
                        $serialsToRestock->push($ps);
                    }
                } else {
                    $available = ProductSerial::where('purchase_order_item_id', $item->id)->where('status', 'returned')->oldest('id')->get();
                    if ($available->count() < $qty) {
                        return $this->error("Only {$available->count()} of {$qty} requested units of {$item->product->name} currently show as returned to the supplier.", 422);
                    }
                    $serialsToRestock = $available->take($qty);
                }
            }

            $resolved[] = ['item' => $item, 'qty' => $qty, 'serials' => $serialsToRestock, 'reason' => $row['reason'] ?? null];
        }

        // Captured before anything is mutated — refund_due_from_supplier is derived live from
        // items.returned_qty, which the loop below immediately starts decrementing. Reading it
        // after the loop (as this used to) silently zeroes it out before it's ever used, since by
        // then the very return this restock is undoing has already been erased from the figures
        // that attribute would need. Mirrors returnToSupplier()'s $outstandingBefore snapshot,
        // taken the same way for the same reason.
        $refundReceivedBefore = $po->refund_received_amount;
        $refundDueBefore = $po->refund_due_from_supplier;

        DB::beginTransaction();
        try {
            $restockedValue = 0;

            foreach ($resolved as $row) {
                /** @var \App\Models\PurchaseOrderItem $item */
                $item = $row['item'];
                $qty = $row['qty'];

                InventoryLog::logChange(
                    $item->product,
                    'addition',
                    $qty,
                    null,
                    $row['reason'] ?? "Restocked from a supplier return via {$po->po_number}",
                    $request->user()
                )->update(['purchase_order_id' => $po->id]);

                $item->product->incrementStock($qty);
                $item->decrement('returned_qty', $qty);

                foreach ($row['serials'] as $serial) {
                    $serial->update(['status' => 'in_stock']);
                }

                $restockedValue += $qty * $item->unit_cost;
            }

            if ($restockedValue > 0) {
                // Mirrors returnToSupplier()'s split, inverted, and unwound in the same order the
                // original return applied it (last-in-first-out): a return first ate into whatever
                // was still outstanding, then anything past that became a refund owed back from the
                // supplier — either left standing as a receivable, or (if collect_refund_now was
                // used) already collected back in cash. Undoing it shrinks whichever of those was
                // used most recently first: cash already collected (giving it back), then a
                // standing refund-due receivable (we're no longer owed it), then accounts payable
                // with whatever's left.
                $againstRefundReceived = min($restockedValue, $refundReceivedBefore);
                $remainingAfterCash = round($restockedValue - $againstRefundReceived, 2);

                $againstRefundDue = min($remainingAfterCash, $refundDueBefore);
                $againstPayable = round($remainingAfterCash - $againstRefundDue, 2);

                if ($againstRefundReceived > 0) {
                    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Restock from supplier return: {$po->po_number}", [
                        ['account_code' => '1020', 'debit' => $againstRefundReceived],
                        ['account_code' => '1000', 'credit' => $againstRefundReceived],
                    ], $request->user());
                    $po->decrement('refund_received_amount', $againstRefundReceived);
                }
                if ($againstRefundDue > 0) {
                    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Restock from supplier return: {$po->po_number}", [
                        ['account_code' => '1020', 'debit' => $againstRefundDue],
                        ['account_code' => '1010', 'credit' => $againstRefundDue],
                    ], $request->user());
                }
                if ($againstPayable > 0) {
                    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Restock from supplier return: {$po->po_number}", [
                        ['account_code' => '1020', 'debit' => $againstPayable],
                        ['account_code' => '2000', 'credit' => $againstPayable],
                    ], $request->user());
                }
            }

            AuditLog::log($request->user(), 'restock_purchase_order_return', 'PurchaseOrder', $po->id, null, $data, "Restocked from a prior supplier return on {$po->po_number}");

            DB::commit();
            return $this->success($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to restock from the return: ' . $e->getMessage());
        }
    }

    /** Short suffix naming where a non-in_stock serial currently is, for a clearer block message. */
    private function describeUnreturnable(ProductSerial $serial): string
    {
        if ($serial->status === 'sold' && $serial->order_item_id) {
            $orderNumber = $serial->orderItem?->order?->order_number;
            return $orderNumber ? " (sold on order {$orderNumber})" : ' (sold)';
        }

        return '';
    }

    /**
     * Fix a mistake in what was recorded at receipt time — the unit cost and/or received
     * quantity for a line item that's already been received (supplier's actual invoice came in
     * different from what was entered, a typo, etc.). Gated behind a tighter permission than the
     * rest of this controller since it corrects financials that were already posted to the
     * ledger, not just data entry on a still-open PO.
     *
     * There's no single "the entry" to reverse and repost — receive() posts ONE combined journal
     * entry per receiving action covering every line received in that call, with no per-item
     * breakdown recorded on the journal lines themselves. Reversing that whole entry to fix one
     * line would also wipe out every other correctly-received line (and any receipts/returns
     * since). So instead this posts a small delta entry that nets Inventory/Accounts Payable to
     * exactly the corrected balance — same effect as "reverse the old hit, post the new one," just
     * scoped to only the difference instead of the whole batch.
     *
     * Body: { items: [{ id, unit_cost?, received_qty?, reason }] }
     */
    public function correctReceipt(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('items.product')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if ($po->status === 'cancelled') {
            return $this->error('Cannot correct a cancelled purchase order.', 422);
        }

        $user = $request->user();
        if (!$user->hasRole('super_admin') && !$user->can('correct_purchase_receipts') && !$user->can('manage_purchases')) {
            return $this->error('You do not have permission to correct a purchase order receipt.', 403);
        }

        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|exists:purchase_order_items,id',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.received_qty' => 'nullable|integer|min:0',
            'items.*.reason' => 'required|string|max:255',
        ]);

        // Resolve + validate every row up front so nothing is half-applied.
        $resolved = [];
        foreach ($data['items'] as $row) {
            $item = $po->items->firstWhere('id', $row['id']);
            if (!$item) {
                continue;
            }

            $oldUnitCost = (float) $item->unit_cost;
            $oldReceivedQty = $item->received_qty;
            $newUnitCost = array_key_exists('unit_cost', $row) && $row['unit_cost'] !== null ? (float) $row['unit_cost'] : $oldUnitCost;
            $newReceivedQty = array_key_exists('received_qty', $row) && $row['received_qty'] !== null ? (int) $row['received_qty'] : $oldReceivedQty;

            if ($oldReceivedQty <= 0) {
                return $this->error("Nothing has been received yet for {$item->product->name} — there's nothing to correct.", 422);
            }
            if (abs($newUnitCost - $oldUnitCost) < 0.005 && $newReceivedQty === $oldReceivedQty) {
                continue; // no-op row — values entered match what's already recorded
            }
            if ($newReceivedQty > $item->quantity) {
                return $this->error("Corrected received quantity for {$item->product->name} can't exceed the ordered quantity ({$item->quantity}).", 422);
            }

            $isSerialized = ProductSerial::where('purchase_order_item_id', $item->id)->exists();
            $soldFromBatch = $isSerialized
                ? ProductSerial::where('purchase_order_item_id', $item->id)->where('status', 'sold')->count()
                : 0;
            $minAllowed = $item->returned_qty + $soldFromBatch;
            if ($newReceivedQty < $minAllowed) {
                return $this->error("Can't reduce the received quantity for {$item->product->name} below {$minAllowed} — that many units from this batch are already sold or returned to the supplier.", 422);
            }

            $qtyDelta = $newReceivedQty - $oldReceivedQty;
            if ($qtyDelta < 0 && ($item->product->stock_qty + $qtyDelta) < 0) {
                return $this->error("Correcting {$item->product->name}'s received quantity down would take stock below zero.", 422);
            }

            $resolved[] = [
                'item' => $item,
                'oldUnitCost' => $oldUnitCost,
                'oldReceivedQty' => $oldReceivedQty,
                'newUnitCost' => $newUnitCost,
                'newReceivedQty' => $newReceivedQty,
                'qtyDelta' => $qtyDelta,
                'reason' => $row['reason'],
            ];
        }

        if (empty($resolved)) {
            return $this->error('Nothing to correct — the values entered match what is already recorded.', 422);
        }

        DB::beginTransaction();
        try {
            foreach ($resolved as $row) {
                /** @var \App\Models\PurchaseOrderItem $item */
                $item = $row['item'];
                $product = $item->product;

                if ($row['qtyDelta'] !== 0) {
                    if ($row['qtyDelta'] > 0) {
                        $product->incrementStock($row['qtyDelta']);
                    } else {
                        $product->decrementStock(abs($row['qtyDelta']));
                    }
                    InventoryLog::logChange(
                        $product,
                        'adjustment',
                        abs($row['qtyDelta']),
                        null,
                        "Correction to PO {$po->po_number} receipt for {$product->name}: {$row['reason']}",
                        $user
                    )->update(['purchase_order_id' => $po->id]);
                }

                $item->update([
                    'unit_cost' => $row['newUnitCost'],
                    'received_qty' => $row['newReceivedQty'],
                    'total_cost' => $item->quantity * $row['newUnitCost'],
                ]);

                $oldValue = round($row['oldReceivedQty'] * $row['oldUnitCost'], 2);
                $newValue = round($row['newReceivedQty'] * $row['newUnitCost'], 2);
                $valueDelta = round($newValue - $oldValue, 2);

                if ($valueDelta > 0) {
                    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id,
                        "Correction to {$po->po_number} receipt for {$product->name} (+" . number_format($valueDelta, 2) . "): {$row['reason']}", [
                        ['account_code' => '1020', 'debit' => $valueDelta],
                        ['account_code' => '2000', 'credit' => $valueDelta],
                    ], $user);
                } elseif ($valueDelta < 0) {
                    $dec = abs($valueDelta);
                    JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id,
                        "Correction to {$po->po_number} receipt for {$product->name} (-" . number_format($dec, 2) . "): {$row['reason']}", [
                        ['account_code' => '2000', 'debit' => $dec],
                        ['account_code' => '1020', 'credit' => $dec],
                    ], $user);
                }

                // Keep current_cost in sync with the fix, but only if nothing newer already moved
                // it past this correction — this repairs what "latest" should have been, it
                // doesn't force it backwards over a genuinely newer purchase received since.
                if (abs($row['newUnitCost'] - $row['oldUnitCost']) >= 0.005 && abs((float) $product->current_cost - $row['oldUnitCost']) < 0.005) {
                    $product->update(['current_cost' => $row['newUnitCost']]);
                }
            }

            $this->recalculateTotals($po, (float) $po->tax, (float) $po->shipping_cost);

            // A received-quantity correction can move the PO between partially_received/received —
            // re-derive it the same way receive() does, but never resurrect a cancelled PO.
            $po->refresh();
            if ($po->status !== 'cancelled') {
                $allReceived = $po->items->every(fn ($i) => $i->isFullyReceived());
                $anyReceived = $po->items->contains(fn ($i) => $i->received_qty > 0);
                $po->update([
                    'status' => $allReceived ? 'received' : ($anyReceived ? 'partially_received' : $po->status),
                ]);
            }

            AuditLog::log($user, 'correct_purchase_receipt', 'PurchaseOrder', $po->id, null, $data, 'Purchase order receipt corrected');

            DB::commit();
            return $this->success($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to correct purchase order receipt: ' . $e->getMessage());
        }
    }

    /** Pay the supplier — reduces Accounts Payable, moves Cash out. Body: { amount } */
    public function pay(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::with('items')->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if (!$po->canPay()) {
            return $this->error('There is nothing outstanding to pay on this purchase order', 422);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:' . $po->outstanding_payable,
        ]);

        DB::beginTransaction();
        try {
            JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $po->id, "Payment to supplier for {$po->po_number}", [
                ['account_code' => '2000', 'debit' => $data['amount']],
                ['account_code' => '1000', 'credit' => $data['amount']],
            ], $request->user());

            $po->increment('paid_amount', $data['amount']);

            AuditLog::log($request->user(), 'pay_purchase_order', 'PurchaseOrder', $po->id, null, ['amount' => $data['amount']], 'Purchase order supplier payment recorded');

            DB::commit();
            return $this->success($po->fresh(self::RELATIONS));
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to record payment: ' . $e->getMessage());
        }
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $po = PurchaseOrder::find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if (!$po->canCancel()) {
            return $this->error('This purchase order cannot be cancelled in its current status', 422);
        }

        $po->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        AuditLog::log($request->user(), 'cancel_purchase_order', 'PurchaseOrder', $po->id, null, null, 'Purchase order cancelled');

        return $this->success($po->fresh(self::RELATIONS));
    }

    public function downloadPdf(int $id): Response|JsonResponse
    {
        $po = PurchaseOrder::with(self::RELATIONS)->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }

        $pdf = Pdf::loadView('invoices.purchase-order', ['po' => $po, 'settings' => $this->brandingSettings()])
            ->setPaper('A4', 'portrait')
            ->setOptions(['defaultFont' => 'DejaVu Sans', 'isRemoteEnabled' => false]);

        return $pdf->download("{$po->po_number}.pdf");
    }

    /**
     * Download a Payment Voucher / Money Receipt PDF — proof of what's been paid to the supplier
     * on this PO. Reflects the cumulative paid_amount (there's no per-transaction payment log to
     * generate one per individual installment from); an optional ?amount= overrides what's shown
     * as "Amount Paid" (capped at what's actually been paid), for reprinting right after a
     * specific payment.
     */
    public function paymentVoucherDownload(Request $request, int $id): Response|JsonResponse
    {
        $po = PurchaseOrder::with(['supplier', 'items'])->find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if ((float) $po->paid_amount <= 0) {
            return $this->error('Nothing has been paid on this purchase order yet — there is nothing to issue a voucher for.', 422);
        }

        $paidToDate = round((float) $po->paid_amount, 2);
        $outstanding = $po->outstanding_payable;
        // Net of returns, so the three figures on the voucher always reconcile
        // (billAmount - paidToDate = outstanding) instead of comparing a gross received value
        // against a returns-aware outstanding figure, which wouldn't add up whenever a partial
        // return has been made against this PO.
        $billAmount = round($po->received_value - $po->returned_value, 2);
        $amountOverride = $request->query('amount');
        $voucherAmount = $amountOverride !== null && is_numeric($amountOverride) && (float) $amountOverride > 0
            ? min((float) $amountOverride, $paidToDate)
            : $paidToDate;

        $pdf = Pdf::loadView('invoices.supplier-payment-voucher', [
            'po'             => $po,
            'settings'       => $this->brandingSettings(),
            'voucherNumber'  => 'PV-' . preg_replace('/^PO-/', '', $po->po_number),
            'voucherAmount'  => $voucherAmount,
            'paidToDate'     => $paidToDate,
            'outstanding'    => $outstanding,
            'billAmount'     => $billAmount,
        ])
            ->setPaper('A4', 'portrait')
            ->setOptions(['defaultFont' => 'DejaVu Sans', 'isRemoteEnabled' => false]);

        return $pdf->download("Payment-Voucher-{$po->po_number}.pdf");
    }

    // --- private helpers ---

    private function validatePurchaseOrder(Request $request): array
    {
        return $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            // Set when this PO is being created specifically to source stock for an order that
            // was already placed (a manual "sell first, source it after" link) — optional.
            'order_id' => 'nullable|exists:orders,id',
            'expected_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'tax' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.warranty_value' => 'nullable|integer|min:0',
            'items.*.warranty_unit' => 'nullable|in:day,week,month,year',
        ]);
    }

    private function syncItems(PurchaseOrder $po, array $items): void
    {
        foreach ($items as $row) {
            // Not defaulted from the product — a supplier's warranty on this specific batch is
            // independent of whatever the business promises customers, so it stays blank unless
            // set explicitly here.
            $po->items()->create([
                'product_id' => $row['product_id'],
                'quantity' => $row['quantity'],
                'unit_cost' => $row['unit_cost'],
                'total_cost' => $row['quantity'] * $row['unit_cost'],
                'warranty_value' => $row['warranty_value'] ?? null,
                'warranty_unit' => $row['warranty_unit'] ?? null,
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
