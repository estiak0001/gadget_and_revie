<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\OrderResource;
use App\Models\AuditLog;
use App\Models\Cart;
use App\Models\InventoryLog;
use App\Models\JournalEntry;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentNotice;
use App\Models\Product;
use App\Models\Service;
use App\Models\VendorProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends BaseController
{
    use \App\Traits\CreatesServiceIntakeOrders;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::with(['vendorProfile', 'items', 'division', 'district', 'area', 'serviceIntake']);

        // For customers, show their orders
        if ($user->isCustomer()) {
            $query->where('customer_id', $user->id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('order_status', $request->status);
        }

        // Filter by payment status
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Date range
        if ($request->has('from_date')) {
            $query->whereDate('created_at', '>=', $request->from_date);
        }
        if ($request->has('to_date')) {
            $query->whereDate('created_at', '<=', $request->to_date);
        }

        $orders = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($orders);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $query = Order::with([
            'customer',
            'vendorProfile',
            'items.product',
            'items.service',
            'paymentNotices',
            'review',
            'division',
            'district',
            'area',
            'serviceIntake',
        ]);

        // For customers, only show their own orders
        if ($user->isCustomer()) {
            $query->where('customer_id', $user->id);
        }

        $order = $query->findOrFail($id);

        return $this->success(new OrderResource($order));
    }

    public function checkout(Request $request): JsonResponse
    {
        $request->validate([
            'cart_id' => 'required|exists:carts,id',
            'payment_method' => 'required|in:bkash,nagad,cash,bank_transfer',
            'customer_name' => 'required|string|max:255',
            'customer_phone' => 'required|string|max:20',
            'customer_email' => 'nullable|email|max:255',
            'customer_address' => 'required|string|max:500',
            'division_id' => 'required|exists:divisions,id',
            'district_id' => 'required|exists:districts,id',
            'area_id' => 'nullable|exists:areas,id',
            'customer_notes' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        $cart = Cart::where('id', $request->cart_id)
            ->where('user_id', $user->id)
            ->with(['activeItems.product.vendorProfile', 'activeItems.service.vendorProfile', 'vendorProfile'])
            ->firstOrFail();

        if ($cart->activeItems->isEmpty()) {
            return $this->error('Cart is empty', 400);
        }

        // SKIP vendor validation for customer order (per user request)
        $vendor = null;

        // Validate stock for products
        foreach ($cart->activeItems as $item) {
            if ($item->item_type === 'product') {
                $product = $item->product;
                if (!$product->canFulfill($item->quantity)) {
                    return $this->error("Not enough stock for {$product->name}. Available: {$product->stock_qty}", 400);
                }
            }
        }

        try {
            DB::beginTransaction();

            // Calculate totals
            $subtotal = $cart->getSubtotal();
            $tax = 0; // Can be calculated based on settings
            $shipping = 0; // Can be calculated based on location
            $discount = 0; // Can be applied from coupons
            $total = $subtotal + $tax + $shipping - $discount;

            // Create order (vendor_profile_id is optional/skipped)
            $order = Order::create([
                'customer_id' => $user->id,
                // 'vendor_profile_id' => $vendor ? $vendor->id : null,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'shipping' => $shipping,
                'discount' => $discount,
                'total' => $total,
                'payment_method' => $request->payment_method,
                'payment_status' => 'pending',
                'order_status' => 'pending',
                'customer_name' => $request->customer_name,
                'customer_phone' => $request->customer_phone,
                'customer_email' => $request->customer_email,
                'customer_address' => $request->customer_address,
                'division_id' => $request->division_id,
                'district_id' => $request->district_id,
                'area_id' => $request->area_id,
                'customer_notes' => $request->customer_notes,
            ]);

            // Create order items
            foreach ($cart->activeItems as $cartItem) {
                $item = $cartItem->item_type === 'product' ? $cartItem->product : $cartItem->service;

                OrderItem::create([
                    'order_id' => $order->id,
                    'item_type' => $cartItem->item_type,
                    'product_id' => $cartItem->product_id,
                    'service_id' => $cartItem->service_id,
                    'item_name' => $item->name,
                    'item_sku' => $cartItem->item_type === 'product' ? $item->sku : $item->code,
                    'quantity' => $cartItem->quantity,
                    'unit_price' => $cartItem->unit_price,
                    'total_price' => $cartItem->unit_price * $cartItem->quantity,
                    'notes' => $cartItem->notes,
                ]);
            }

            // Create payment notice (skip vendor-specific instructions)
            $paymentInstructions = null;
            PaymentNotice::create([
                'order_id' => $order->id,
                // 'vendor_profile_id' => $vendor ? $vendor->id : null,
                'method' => $request->payment_method,
                'instructions_shown' => null,
                'amount' => $total,
                'status' => 'pending',
            ]);

            // Clear cart
            $cart->clearCart();
            if ($cart->items()->count() === 0) {
                $cart->delete();
            }

            // Log audit
            AuditLog::log($user, 'create_order', 'Order', $order->id, null, [
                'order_number' => $order->order_number,
                'total' => $total,
            ], 'Order created');

            // SKIP vendor notification for customer order

            DB::commit();

            $order->load([
                'vendorProfile',
                'items.product',
                'items.service',
                'paymentNotices',
            ]);

            return $this->created([
                'order' => new OrderResource($order),
                'payment_instructions' => $paymentInstructions,
            ], 'Order placed successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create order: ' . $e->getMessage());
        }
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = Order::where('customer_id', $user->id)->findOrFail($id);

        if (!$order->canBeCancelled()) {
            return $this->error('This order cannot be cancelled', 400);
        }

        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $oldStatus = $order->order_status;
        $wasPaidOrPartial = in_array($order->payment_status, ['paid', 'partially_paid'], true);
        $order->cancel();
        $order->update([
            'customer_notes' => $order->customer_notes . "\n\nCancellation reason: " . ($request->reason ?? 'Not provided'),
            ...($wasPaidOrPartial ? ['payment_status' => 'refunded', 'refund_amount' => $order->paid_amount] : []),
        ]);

        // If the order had already had some payment recorded (e.g. a pre-paid order created
        // directly by an admin, or a partial payment), reverse all of that revenue now instead
        // of leaving it recognized forever.
        if ($wasPaidOrPartial) {
            JournalEntry::reverseAllFor('Order', $order->id, "Order #{$order->order_number} cancelled by customer (was already paid)", $user);
        }

        // Restore stock for products
        foreach ($order->items as $item) {
            if ($item->item_type === 'product' && $item->product) {
                InventoryLog::logChange(
                    $item->product,
                    'return',
                    $item->quantity,
                    $order,
                    'Order cancelled',
                    $user
                );
                $item->product->incrementStock($item->quantity);
            }
        }

        AuditLog::log($user, 'cancel_order', 'Order', $order->id, [
            'status' => $oldStatus,
        ], [
            'status' => 'cancelled',
        ], 'Order cancelled by customer');

        // Notify vendor (only if vendor exists)
        if ($order->vendorProfile && $order->vendorProfile->user) {
            Notification::notify(
                $order->vendorProfile->user,
                'order_cancelled',
                'Order Cancelled',
                "Order #{$order->order_number} has been cancelled by the customer",
                ['order_id' => $order->id],
                "/vendor/orders/{$order->id}"
            );
        }

        return $this->success(new OrderResource($order->fresh()), 'Order cancelled successfully');
    }

    public function submitPaymentProof(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $order = Order::where('customer_id', $user->id)->findOrFail($id);

        $request->validate([
            'transaction_reference' => 'nullable|string|max:255',
            'payment_proof_image' => 'nullable|image|max:2048',
        ]);

        $paymentNotice = $order->paymentNotices()->latest()->first();

        if (!$paymentNotice) {
            return $this->error('No payment notice found', 400);
        }

        $data = [
            'transaction_reference' => $request->transaction_reference,
        ];

        if ($request->hasFile('payment_proof_image')) {
            $data['payment_proof_image'] = $request->file('payment_proof_image')
                ->store('payment-proofs', 'public');
        }

        $paymentNotice->update($data);
        $order->update(['payment_status' => 'awaiting_confirmation']);

        // Notify vendor (only if vendor exists)
        if ($order->vendorProfile && $order->vendorProfile->user) {
            Notification::notify(
                $order->vendorProfile->user,
                'payment_submitted',
                'Payment Proof Submitted',
                "Payment proof submitted for order #{$order->order_number}",
                ['order_id' => $order->id],
                "/vendor/orders/{$order->id}"
            );
        }

        return $this->success(new OrderResource($order->fresh()), 'Payment proof submitted');
    }

    public function placeServiceOrder(Request $request): JsonResponse
    {
        $request->validate([
            'service_id' => 'required|exists:services,id',
            'vendor_profile_id' => 'nullable|exists:vendor_profiles,id',
            'payment_method' => 'required|in:bkash,nagad,cash,bank_transfer',
            'customer_name' => 'required|string|max:255',
            'customer_phone' => 'required|string|max:20',
            'customer_email' => 'nullable|email|max:255',
            'customer_address' => 'required|string|max:500',
            'division_id' => 'required|exists:divisions,id',
            'district_id' => 'required|exists:districts,id',
            'area_id' => 'nullable|exists:areas,id',
            'customer_notes' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();
        $service = Service::findOrFail($request->service_id);

        try {
            DB::beginTransaction();

            // Service orders are priced later. The device is received as a
            // service intake (no cost) and the price is confirmed by the admin
            // once it is agreed with the customer.
            $order = $this->placeServiceOrderWithIntake($service, [
                'customer_id'       => $user->id,
                'vendor_profile_id' => $request->vendor_profile_id,
                'payment_method'    => $request->payment_method,
                'customer_name'     => $request->customer_name,
                'customer_phone'    => $request->customer_phone,
                'customer_email'    => $request->customer_email,
                'customer_address'  => $request->customer_address,
                'division_id'       => $request->division_id,
                'district_id'       => $request->district_id,
                'area_id'           => $request->area_id,
                'customer_notes'    => $request->customer_notes,
                'created_by'        => $user->id,
            ]);

            AuditLog::log($user, 'create_service_order', 'Order', $order->id, null, [
                'order_number' => $order->order_number,
                'service_id' => $service->id,
            ], 'Service order created (pending price confirmation)');

            DB::commit();

            $order->load([
                'vendorProfile',
                'items.service',
                'paymentNotices',
                'serviceIntake',
            ]);

            return $this->created([
                'order' => new OrderResource($order),
                'payment_instructions' => null,
            ], 'Service order placed. We will confirm the price after inspecting your device.');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create service order: ' . $e->getMessage());
        }
    }
}
