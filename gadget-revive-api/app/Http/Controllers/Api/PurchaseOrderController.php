<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\InventoryLog;
use App\Models\JournalEntry;
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

    private const RELATIONS = ['supplier', 'items.product', 'creator', 'expense'];

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

        $orders = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($orders);
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
        $po = PurchaseOrder::find($id);
        if (!$po) {
            return $this->notFound('Purchase order not found');
        }
        if ($po->status !== 'draft') {
            return $this->error('Only draft purchase orders can be deleted', 422);
        }

        $po->delete();

        AuditLog::log($request->user(), 'delete_purchase_order', 'PurchaseOrder', $id, null, null, 'Purchase order deleted');

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
        ]);

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

                $item->product->incrementStock($qtyToAdd);
                $item->increment('received_qty', $qtyToAdd);

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
