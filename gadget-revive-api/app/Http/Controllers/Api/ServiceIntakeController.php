<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentNotice;
use App\Models\ServiceIntake;
use App\Models\ServiceIntakeItem;
use App\Traits\ResolvesBrandingSettings;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ServiceIntakeController extends BaseController
{
    use ResolvesBrandingSettings;

    private const RELATIONS = [
        'items.service',
        'customer',
        'branchLocation',
        'division',
        'district',
        'area',
        'order',
        'creator',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = ServiceIntake::with(['items', 'customer', 'branchLocation', 'order']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('receipt_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%");
            });
        }

        if ($request->filled('from_date')) {
            $query->whereDate('received_at', '>=', $request->from_date);
        }
        if ($request->filled('to_date')) {
            $query->whereDate('received_at', '<=', $request->to_date);
        }

        $intakes = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($intakes);
    }

    public function show(int $id): JsonResponse
    {
        $intake = ServiceIntake::with(self::RELATIONS)->find($id);

        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        return $this->success($intake);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateIntake($request);

        try {
            DB::beginTransaction();

            $intake = ServiceIntake::create([
                'customer_id'          => $data['customer_id'] ?? null,
                'order_id'             => $data['order_id'] ?? null,
                'customer_name'        => $data['customer_name'],
                'customer_phone'       => $data['customer_phone'],
                'customer_email'       => $data['customer_email'] ?? null,
                'customer_address'     => $data['customer_address'] ?? null,
                'branch_location_id'   => $data['branch_location_id'] ?? null,
                'division_id'          => $data['division_id'] ?? null,
                'district_id'          => $data['district_id'] ?? null,
                'area_id'              => $data['area_id'] ?? null,
                'status'               => $data['status'] ?? 'received',
                'estimated_cost'       => $data['estimated_cost'] ?? null,
                'received_at'          => $data['received_at'] ?? now(),
                'expected_delivery_at' => $data['expected_delivery_at'] ?? null,
                'notes'                => $data['notes'] ?? null,
                'admin_notes'          => $data['admin_notes'] ?? null,
                'created_by'           => $request->user()?->id,
            ]);

            $this->syncItems($intake, $data['items']);

            AuditLog::log($request->user(), 'create_service_intake', 'ServiceIntake', $intake->id, null, [
                'receipt_number' => $intake->receipt_number,
            ], 'Service intake created');

            DB::commit();

            return $this->created($intake->load(self::RELATIONS), 'Service intake created successfully.');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create service intake: ' . $e->getMessage());
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $intake = ServiceIntake::find($id);

        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        if ($intake->isLocked()) {
            return $this->error('This intake is finalized or cancelled and can no longer be edited.', 422);
        }

        $data = $this->validateIntake($request);

        try {
            DB::beginTransaction();

            $intake->update([
                'customer_id'          => $data['customer_id'] ?? null,
                'order_id'             => $data['order_id'] ?? $intake->order_id,
                'customer_name'        => $data['customer_name'],
                'customer_phone'       => $data['customer_phone'],
                'customer_email'       => $data['customer_email'] ?? null,
                'customer_address'     => $data['customer_address'] ?? null,
                'branch_location_id'   => $data['branch_location_id'] ?? null,
                'division_id'          => $data['division_id'] ?? null,
                'district_id'          => $data['district_id'] ?? null,
                'area_id'              => $data['area_id'] ?? null,
                'status'               => $data['status'] ?? $intake->status,
                'estimated_cost'       => $data['estimated_cost'] ?? null,
                'received_at'          => $data['received_at'] ?? $intake->received_at,
                'expected_delivery_at' => $data['expected_delivery_at'] ?? null,
                'notes'                => $data['notes'] ?? null,
                'admin_notes'          => $data['admin_notes'] ?? null,
            ]);

            $intake->items()->delete();
            $this->syncItems($intake, $data['items']);

            DB::commit();

            return $this->success($intake->fresh(self::RELATIONS), 'Service intake updated successfully.');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to update service intake: ' . $e->getMessage());
        }
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $intake = ServiceIntake::find($id);

        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        $request->validate([
            'status' => 'required|in:received,in_progress,ready,converted,delivered,cancelled',
        ]);

        $update = ['status' => $request->status];
        if ($request->status === 'delivered' && !$intake->delivered_at) {
            $update['delivered_at'] = now();
        }

        $intake->update($update);

        return $this->success($intake->fresh(self::RELATIONS), 'Status updated successfully.');
    }

    public function destroy(int $id): JsonResponse
    {
        $intake = ServiceIntake::find($id);

        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        if ($intake->isFinalized()) {
            return $this->error('Cannot delete an intake that has been converted to an order.', 422);
        }

        $intake->delete();

        return $this->noContent('Service intake deleted successfully.');
    }

    /**
     * Convert a received intake into a service order. The intake items become
     * order items (priced from their estimate), and the intake is linked to
     * the new order.
     */
    public function convertToOrder(Request $request, int $id): JsonResponse
    {
        $intake = ServiceIntake::with('items')->find($id);

        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        if (!$intake->canBeConverted()) {
            return $this->error('This intake cannot be converted (already converted or cancelled).', 422);
        }

        $validated = $request->validate([
            'payment_method' => 'required|in:bkash,nagad,cash,bank_transfer',
            'payment_status' => 'nullable|in:pending,awaiting_confirmation,paid,failed,refunded',
            'order_status'   => 'nullable|in:pending,accepted,in_progress,awaiting_payment,completed',
        ]);

        try {
            DB::beginTransaction();

            $subtotal = $intake->items->sum(function ($item) {
                return (float) ($item->estimated_price ?? 0) * (int) $item->quantity;
            });
            $total = $subtotal > 0 ? $subtotal : (float) ($intake->estimated_cost ?? 0);

            $order = Order::create([
                'customer_id'      => $intake->customer_id,
                'subtotal'         => $total,
                'tax'              => 0,
                'shipping'         => 0,
                'discount'         => 0,
                'total'            => $total,
                'payment_method'   => $validated['payment_method'],
                'payment_status'   => $validated['payment_status'] ?? 'pending',
                'order_status'     => $validated['order_status'] ?? 'in_progress',
                'customer_name'    => $intake->customer_name,
                'customer_phone'   => $intake->customer_phone,
                'customer_email'   => $intake->customer_email,
                'customer_address' => $intake->customer_address,
                'division_id'      => $intake->division_id,
                'district_id'      => $intake->district_id,
                'area_id'          => $intake->area_id,
                'customer_notes'   => $intake->notes,
                'admin_notes'      => "Converted from service receipt {$intake->receipt_number}." . ($intake->admin_notes ? "\n{$intake->admin_notes}" : ''),
            ]);

            foreach ($intake->items as $item) {
                $unit = (float) ($item->estimated_price ?? 0);
                OrderItem::create([
                    'order_id'    => $order->id,
                    'item_type'   => 'service',
                    'service_id'  => $item->service_id,
                    'item_name'   => $item->item_name,
                    'item_sku'    => $item->serial_number,
                    'quantity'    => $item->quantity,
                    'unit_price'  => $unit,
                    'total_price' => $unit * (int) $item->quantity,
                    'notes'       => $item->problem_reported,
                ]);
            }

            PaymentNotice::create([
                'order_id'           => $order->id,
                'method'             => $validated['payment_method'],
                'instructions_shown' => null,
                'amount'             => $total,
                'status'             => 'pending',
            ]);

            $intake->update([
                'order_id' => $order->id,
                'status'   => 'converted',
            ]);

            AuditLog::log($request->user(), 'convert_service_intake', 'ServiceIntake', $intake->id, null, [
                'receipt_number' => $intake->receipt_number,
                'order_number'   => $order->order_number,
                'total'          => $total,
            ], 'Service intake converted to order');

            DB::commit();

            $order->load(['items.service', 'paymentNotices']);

            return $this->created([
                'intake' => $intake->fresh(self::RELATIONS),
                'order'  => $order,
            ], 'Service intake converted to order successfully.');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to convert intake: ' . $e->getMessage());
        }
    }

    /**
     * Confirm the price for an intake that is LINKED to an existing service
     * order (the customer ordered the service first, then dropped off the
     * device). After the device is investigated, the final per-item prices are
     * written back onto the linked order: its line items are rebuilt from the
     * received items, totals recalculated, and the order moved to awaiting
     * payment so an invoice can be issued.
     */
    public function confirmPrice(Request $request, int $id): JsonResponse
    {
        $intake = ServiceIntake::with(['items', 'order'])->find($id);

        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        if (!$intake->canConfirmPrice() || !$intake->order) {
            return $this->error('This intake is not linked to an order. Use "Convert to Order" instead.', 422);
        }

        $validated = $request->validate([
            'items'              => 'required|array|min:1',
            'items.*.id'         => 'required|integer',
            'items.*.final_price' => 'required|numeric|min:0',
            'items.*.quantity'   => 'nullable|integer|min:1',
            'tax'                => 'nullable|numeric|min:0',
            'shipping'           => 'nullable|numeric|min:0',
            'discount'           => 'nullable|numeric|min:0',
            'payment_method'     => 'nullable|in:bkash,nagad,cash,bank_transfer',
            'payment_status'     => 'nullable|in:pending,awaiting_confirmation,paid,failed,refunded',
            'order_status'       => 'nullable|in:pending,accepted,in_progress,awaiting_payment,completed',
        ]);

        // Map intake item id → confirmed price/qty
        $priceMap = collect($validated['items'])->keyBy('id');
        $intakeItems = $intake->items->whereIn('id', $priceMap->keys()->all());

        if ($intakeItems->isEmpty()) {
            return $this->error('No matching intake items to price.', 422);
        }

        try {
            DB::beginTransaction();

            $order = $intake->order;
            $tax      = (float) ($validated['tax'] ?? $order->tax ?? 0);
            $shipping = (float) ($validated['shipping'] ?? $order->shipping ?? 0);
            $discount = (float) ($validated['discount'] ?? $order->discount ?? 0);

            // Rebuild the order's line items from the received (intake) items,
            // priced with the confirmed amounts.
            $order->items()->delete();
            $subtotal = 0;

            foreach ($intakeItems as $item) {
                $entry = $priceMap->get($item->id);
                $price = (float) $entry['final_price'];
                $qty   = (int) ($entry['quantity'] ?? $item->quantity ?? 1);

                // Record the confirmed price back on the intake item too.
                $item->update(['estimated_price' => $price, 'quantity' => $qty]);

                $lineTotal = $price * $qty;
                $subtotal += $lineTotal;

                OrderItem::create([
                    'order_id'    => $order->id,
                    'item_type'   => 'service',
                    'service_id'  => $item->service_id,
                    'item_name'   => $item->item_name,
                    'item_sku'    => $item->serial_number,
                    'quantity'    => $qty,
                    'unit_price'  => $price,
                    'total_price' => $lineTotal,
                    'notes'       => $item->problem_reported,
                ]);
            }

            $total = $subtotal + $tax + $shipping - $discount;

            $order->update([
                'subtotal'       => $subtotal,
                'tax'            => $tax,
                'shipping'       => $shipping,
                'discount'       => $discount,
                'total'          => $total,
                'payment_method' => $validated['payment_method'] ?? $order->payment_method,
                'payment_status' => $validated['payment_status'] ?? $order->payment_status,
                'order_status'   => $validated['order_status'] ?? 'awaiting_payment',
            ]);

            // Keep the linked payment notice amount in sync, if present.
            $notice = $order->paymentNotices()->latest()->first();
            if ($notice) {
                $notice->update(['amount' => $total]);
            }

            $intake->update([
                'status'         => 'ready',
                'estimated_cost' => $total,
            ]);

            AuditLog::log($request->user(), 'confirm_service_intake_price', 'ServiceIntake', $intake->id, null, [
                'receipt_number' => $intake->receipt_number,
                'order_number'   => $order->order_number,
                'total'          => $total,
            ], 'Service intake price confirmed on linked order');

            DB::commit();

            $order->load(['items.service', 'paymentNotices']);

            return $this->success([
                'intake' => $intake->fresh(self::RELATIONS),
                'order'  => $order,
            ], 'Price confirmed. The order is ready for invoicing.');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to confirm price: ' . $e->getMessage());
        }
    }

    public function downloadReceipt(int $id): Response|JsonResponse
    {
        $intake = $this->loadForPdf($id);
        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        return $this->buildReceiptPdf($intake)->download("Service-Receipt-{$intake->receipt_number}.pdf");
    }

    public function streamReceipt(int $id): Response|JsonResponse
    {
        $intake = $this->loadForPdf($id);
        if (!$intake) {
            return $this->notFound('Service intake not found.');
        }

        return $this->buildReceiptPdf($intake)->stream("Service-Receipt-{$intake->receipt_number}.pdf");
    }

    /**
     * Download the service receipt for an order the authenticated user owns
     * (admins may access any order). Available before the price is confirmed.
     */
    public function customerReceiptDownload(Request $request, int $orderId): Response|JsonResponse
    {
        $intake = $this->resolveOwnedIntake($request, $orderId);
        if (!$intake) {
            return $this->notFound('Service receipt not found for this order.');
        }

        return $this->buildReceiptPdf($intake)->download("Service-Receipt-{$intake->receipt_number}.pdf");
    }

    public function customerReceiptStream(Request $request, int $orderId): Response|JsonResponse
    {
        $intake = $this->resolveOwnedIntake($request, $orderId);
        if (!$intake) {
            return $this->notFound('Service receipt not found for this order.');
        }

        return $this->buildReceiptPdf($intake)->stream("Service-Receipt-{$intake->receipt_number}.pdf");
    }

    /**
     * Download the service receipt for a guest order by order number.
     */
    public function guestReceiptDownload(Request $request): Response|JsonResponse
    {
        $request->validate([
            'order_number' => 'required|string',
        ]);

        $order = Order::where('order_number', $request->order_number)->with('customer')->first();

        if (!$order || !$order->allowsGuestStyleAccess()) {
            return $this->notFound('Service receipt not found.');
        }

        $intake = $this->loadOrderIntakeForPdf($order);
        if (!$intake) {
            return $this->notFound('Service receipt not found for this order.');
        }

        return $this->buildReceiptPdf($intake)->download("Service-Receipt-{$intake->receipt_number}.pdf");
    }

    // ─── Helpers ──────────────────────────────────────

    /**
     * Resolve the service intake linked to an order, enforcing ownership:
     * admins see any order, other users only their own.
     */
    private function resolveOwnedIntake(Request $request, int $orderId): ?ServiceIntake
    {
        $user = $request->user();
        $query = Order::query();

        if (!$user->isAdmin()) {
            $query->where('customer_id', $user->id);
        }

        $order = $query->find($orderId);
        if (!$order) {
            return null;
        }

        return $this->loadOrderIntakeForPdf($order);
    }

    private function loadOrderIntakeForPdf(Order $order): ?ServiceIntake
    {
        $intake = $order->serviceIntake()->first();
        if (!$intake) {
            return null;
        }

        return $this->loadForPdf($intake->id);
    }

    private function validateIntake(Request $request): array
    {
        return $request->validate([
            'customer_id'          => 'nullable|exists:users,id',
            'order_id'             => 'nullable|exists:orders,id',
            'customer_name'        => 'required|string|max:255',
            'customer_phone'       => 'required|string|max:20',
            'customer_email'       => 'nullable|email|max:255',
            'customer_address'     => 'nullable|string|max:500',
            'branch_location_id'   => 'nullable|exists:branch_locations,id',
            'division_id'          => 'nullable|exists:divisions,id',
            'district_id'          => 'nullable|exists:districts,id',
            'area_id'              => 'nullable|exists:areas,id',
            'status'               => 'nullable|in:received,in_progress,ready,converted,delivered,cancelled',
            'estimated_cost'       => 'nullable|numeric|min:0',
            'received_at'          => 'nullable|date',
            'expected_delivery_at' => 'nullable|date',
            'notes'                => 'nullable|string|max:1000',
            'admin_notes'          => 'nullable|string|max:1000',
            'items'                => 'required|array|min:1',
            'items.*.service_id'       => 'nullable|exists:services,id',
            'items.*.item_name'        => 'required|string|max:255',
            'items.*.serial_number'    => 'nullable|string|max:255',
            'items.*.problem_reported' => 'nullable|string|max:1000',
            'items.*.accessories'      => 'nullable|string|max:255',
            'items.*.condition_notes'  => 'nullable|string|max:1000',
            'items.*.quantity'         => 'required|integer|min:1',
            'items.*.estimated_price'  => 'nullable|numeric|min:0',
        ]);
    }

    private function syncItems(ServiceIntake $intake, array $items): void
    {
        foreach ($items as $item) {
            ServiceIntakeItem::create([
                'service_intake_id' => $intake->id,
                'service_id'        => $item['service_id'] ?? null,
                'item_name'         => $item['item_name'],
                'serial_number'     => $item['serial_number'] ?? null,
                'problem_reported'  => $item['problem_reported'] ?? null,
                'accessories'       => $item['accessories'] ?? null,
                'condition_notes'   => $item['condition_notes'] ?? null,
                'quantity'          => $item['quantity'] ?? 1,
                'estimated_price'   => $item['estimated_price'] ?? null,
            ]);
        }
    }

    private function loadForPdf(int $id): ?ServiceIntake
    {
        return ServiceIntake::with(['items', 'branchLocation', 'division', 'district', 'area'])->find($id);
    }

    private function buildReceiptPdf(ServiceIntake $intake): \Barryvdh\DomPDF\PDF
    {
        ini_set('memory_limit', '256M');

        $pdf = Pdf::loadView('invoices.service-receipt', [
            'intake'   => $intake,
            'settings' => $this->brandingSettings(),
        ]);

        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions([
            'dpi'                  => 150,
            'defaultFont'          => 'DejaVu Sans',
            'isRemoteEnabled'      => false,
            'isHtml5ParserEnabled' => true,
            'enable_php'           => false,
        ]);

        return $pdf;
    }
}
