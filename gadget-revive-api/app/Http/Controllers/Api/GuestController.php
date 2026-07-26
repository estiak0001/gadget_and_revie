<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\CartResource;
use App\Http\Resources\OrderResource;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentNotice;
use App\Models\Product;
use App\Models\Service;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * GuestController handles cart and order operations for unauthenticated (guest) users.
 * Guests are identified by a session_id UUID stored client-side.
 */
class GuestController extends BaseController
{
    use \App\Traits\CreatesServiceIntakeOrders;

    /**
     * Get guest session ID from request header.
     * Returns null if not present.
     */
    private function getSessionId(Request $request): ?string
    {
        return $request->header('X-Guest-Session-Id') ?: null;
    }

    // =========================================================================
    // CART
    // =========================================================================

    /**
     * GET /guest/cart
     * Returns the current guest cart (all items grouped).
     */
    public function getCart(Request $request): JsonResponse
    {
        $sessionId = $this->getSessionId($request);

        if (!$sessionId) {
            return $this->success(['carts' => [], 'total_items' => 0, 'total_amount' => 0]);
        }

        $carts = Cart::where('session_id', $sessionId)
            ->whereNull('user_id')
            ->with([
                'activeItems.product.category',
                'activeItems.service.category',
            ])
            ->get();

        return $this->success(CartResource::collection($carts));
    }

    /**
     * POST /guest/cart/items
     * Add item to guest cart.
     */
    public function addItem(Request $request): JsonResponse
    {
        $request->validate([
            'item_type'    => 'required|in:product,service',
            'product_id'   => 'required_if:item_type,product|exists:products,id',
            'service_id'   => 'required_if:item_type,service|exists:services,id',
            'quantity'     => 'required|integer|min:1|max:100',
            'notes'        => 'nullable|string|max:500',
            'session_id'   => 'required|string|max:64',
        ]);

        $sessionId = $request->session_id;
        $itemType  = $request->item_type;

        // Resolve product or service
        if ($itemType === 'product') {
            $item          = Product::findOrFail($request->product_id);
            $vendorProfileId = $item->vendor_profile_id;
            $unitPrice     = $item->getCurrentPrice();

            if (!$item->canFulfill($request->quantity)) {
                return $this->error('Not enough stock available. Available: ' . $item->stock_qty, 400);
            }
        } else {
            $item          = Service::findOrFail($request->service_id);
            $vendorProfileId = $item->vendor_profile_id;
            $unitPrice     = $item->getCurrentPrice();
        }

        // Get or create guest cart for this vendor
        $cart = Cart::firstOrCreate(
            [
                'session_id'       => $sessionId,
                'vendor_profile_id' => $vendorProfileId,
            ],
            [
                'user_id' => null,
            ]
        );

        // Check if item already exists in cart
        $existingItem = CartItem::where('cart_id', $cart->id)
            ->where('item_type', $itemType)
            ->where($itemType === 'product' ? 'product_id' : 'service_id', $item->id)
            ->where('is_saved_for_later', false)
            ->first();

        if ($existingItem) {
            $newQuantity = $existingItem->quantity + $request->quantity;

            if ($itemType === 'product' && !$item->canFulfill($newQuantity)) {
                return $this->error('Not enough stock available. Available: ' . $item->stock_qty, 400);
            }

            $existingItem->update([
                'quantity'   => $newQuantity,
                'unit_price' => $unitPrice,
            ]);
        } else {
            CartItem::create([
                'cart_id'    => $cart->id,
                'item_type'  => $itemType,
                'product_id' => $itemType === 'product' ? $item->id : null,
                'service_id' => $itemType === 'service' ? $item->id : null,
                'quantity'   => $request->quantity,
                'unit_price' => $unitPrice,
                'notes'      => $request->notes,
            ]);
        }

        $cart->load([
            'activeItems.product.category',
            'activeItems.service.category',
        ]);

        return $this->success(new CartResource($cart), 'Item added to cart');
    }

    /**
     * PUT /guest/cart/items/{itemId}
     * Update guest cart item quantity.
     */
    public function updateItem(Request $request, int $itemId): JsonResponse
    {
        $request->validate([
            'quantity'    => 'required|integer|min:1|max:100',
            'notes'       => 'nullable|string|max:500',
            'session_id'  => 'required|string|max:64',
        ]);

        $sessionId = $request->session_id;

        $cartItem = CartItem::whereHas('cart', function ($q) use ($sessionId) {
            $q->where('session_id', $sessionId)->whereNull('user_id');
        })->findOrFail($itemId);

        // Stock check for products
        if ($cartItem->item_type === 'product') {
            $product = $cartItem->product;
            if (!$product->canFulfill($request->quantity)) {
                return $this->error('Not enough stock available. Available: ' . $product->stock_qty, 400);
            }
        }

        $cartItem->update([
            'quantity' => $request->quantity,
            'notes'    => $request->notes ?? $cartItem->notes,
        ]);

        return $this->success($cartItem, 'Cart item updated');
    }

    /**
     * DELETE /guest/cart/items/{itemId}
     * Remove an item from guest cart.
     */
    public function removeItem(Request $request, int $itemId): JsonResponse
    {
        $sessionId = $request->header('X-Guest-Session-Id');

        $cartItem = CartItem::whereHas('cart', function ($q) use ($sessionId) {
            $q->where('session_id', $sessionId)->whereNull('user_id');
        })->findOrFail($itemId);

        $cart = $cartItem->cart;
        $cartItem->delete();

        if ($cart->items()->count() === 0) {
            $cart->delete();
        }

        return $this->success(null, 'Item removed from cart');
    }

    /**
     * DELETE /guest/cart
     * Clear entire guest cart.
     */
    public function clearCart(Request $request): JsonResponse
    {
        $sessionId = $request->header('X-Guest-Session-Id');

        if (!$sessionId) {
            return $this->success(null, 'Cart cleared');
        }

        Cart::where('session_id', $sessionId)
            ->whereNull('user_id')
            ->each(function ($cart) {
                $cart->clearCart();
                $cart->delete();
            });

        return $this->success(null, 'Cart cleared');
    }

    // =========================================================================
    // ORDERS
    // =========================================================================

    /**
     * POST /guest/orders
     * Place a guest order without authentication.
     */
    public function placeOrder(Request $request): JsonResponse
    {
        $request->validate([
            'session_id'       => 'required|string|max:64',
            'cart_id'          => 'required|exists:carts,id',
            'payment_method'   => 'required|in:bkash,nagad,cash,bank_transfer',
            'customer_name'    => 'required|string|max:255',
            'customer_phone'   => 'required|string|max:20',
            'customer_email'   => 'nullable|email|max:255',
            'customer_address' => 'required|string|max:500',
            'division_id'      => 'required|exists:divisions,id',
            'district_id'      => 'required|exists:districts,id',
            'area_id'          => 'nullable|exists:areas,id',
            'customer_notes'   => 'nullable|string|max:1000',
        ]);

        $sessionId = $request->session_id;

        // Verify cart belongs to this guest session
        $cart = Cart::where('id', $request->cart_id)
            ->where('session_id', $sessionId)
            ->whereNull('user_id')
            ->with(['activeItems.product', 'activeItems.service'])
            ->firstOrFail();

        if ($cart->activeItems->isEmpty()) {
            return $this->error('Cart is empty', 400);
        }

        // Validate stock for products
        foreach ($cart->activeItems as $item) {
            if ($item->item_type === 'product') {
                $product = $item->product;
                if (!$product->canFulfill($item->quantity)) {
                    return $this->error(
                        "Not enough stock for {$product->name}. Available: {$product->stock_qty}",
                        400
                    );
                }
            }
        }

        try {
            DB::beginTransaction();

            $subtotal = $cart->getSubtotal();
            $tax      = 0;
            $shipping = 0;
            $discount = 0;
            $total    = $subtotal + $tax + $shipping - $discount;

            // Find or silently create a customer account from the typed checkout details, so this
            // person shows up in the Customers page — still a guest-style order (see
            // Order::allowsGuestStyleAccess()), no login required for them to track/download it.
            $customer = User::findOrCreateCustomer($request->customer_name, $request->customer_phone, $request->customer_email);

            $order = Order::create([
                'session_id'       => $sessionId,
                'customer_id'      => $customer?->id,
                'subtotal'         => $subtotal,
                'tax'              => $tax,
                'shipping'         => $shipping,
                'discount'         => $discount,
                'total'            => $total,
                'payment_method'   => $request->payment_method,
                'payment_status'   => 'pending',
                'order_status'     => 'pending',
                'customer_name'    => $request->customer_name,
                'customer_phone'   => $request->customer_phone,
                'customer_email'   => $request->customer_email,
                'customer_address' => $request->customer_address,
                'division_id'      => $request->division_id,
                'district_id'      => $request->district_id,
                'area_id'          => $request->area_id,
                'customer_notes'   => $request->customer_notes,
            ]);

            // Create order items
            foreach ($cart->activeItems as $cartItem) {
                $item = $cartItem->item_type === 'product' ? $cartItem->product : $cartItem->service;

                OrderItem::create([
                    'order_id'   => $order->id,
                    'item_type'  => $cartItem->item_type,
                    'product_id' => $cartItem->product_id,
                    'service_id' => $cartItem->service_id,
                    'item_name'  => $item->name,
                    'item_sku'   => $cartItem->item_type === 'product' ? $item->sku : ($item->code ?? null),
                    'quantity'   => $cartItem->quantity,
                    'unit_price' => $cartItem->unit_price,
                    'total_price' => $cartItem->unit_price * $cartItem->quantity,
                    'notes'      => $cartItem->notes,
                ]);
            }

            // Create payment notice
            PaymentNotice::create([
                'order_id'             => $order->id,
                'method'               => $request->payment_method,
                'instructions_shown'   => null,
                'amount'               => $total,
                'status'               => 'pending',
            ]);

            // Clear guest cart
            $cart->clearCart();
            if ($cart->items()->count() === 0) {
                $cart->delete();
            }

            DB::commit();

            $order->load(['items.product', 'items.service', 'paymentNotices']);

            return $this->created([
                'order'                => new OrderResource($order),
                'payment_instructions' => null,
            ], 'Order placed successfully');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create order: ' . $e->getMessage());
        }
    }

    /**
     * POST /guest/orders/service
     * Place a direct service booking without authentication.
     */
    public function placeServiceOrder(Request $request): JsonResponse
    {
        $request->validate([
            'session_id'        => 'nullable|string|max:64',
            'service_id'        => 'required|exists:services,id',
            'vendor_profile_id' => 'nullable|exists:vendor_profiles,id',
            'payment_method'    => 'required|in:bkash,nagad,cash,bank_transfer',
            'customer_name'     => 'required|string|max:255',
            'customer_phone'    => 'required|string|max:20',
            'customer_email'    => 'nullable|email|max:255',
            'customer_address'  => 'required|string|max:500',
            'division_id'       => 'required|exists:divisions,id',
            'district_id'       => 'required|exists:districts,id',
            'area_id'           => 'nullable|exists:areas,id',
            'customer_notes'    => 'nullable|string|max:1000',
        ]);

        $service   = Service::findOrFail($request->service_id);
        $sessionId = $request->session_id ?: $this->getSessionId($request);

        try {
            DB::beginTransaction();

            // Find or silently create a customer account from the typed details (see placeOrder()).
            $customer = User::findOrCreateCustomer($request->customer_name, $request->customer_phone, $request->customer_email);

            // Service orders are priced later: the device is received as a
            // service intake (no cost) and the price is confirmed by the admin
            // once it is agreed with the customer.
            $order = $this->placeServiceOrderWithIntake($service, [
                'session_id'        => $sessionId,
                'customer_id'       => $customer?->id,
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
            ]);

            DB::commit();

            $order->load(['vendorProfile', 'items.service', 'paymentNotices', 'serviceIntake']);

            return $this->created([
                'order'                => new OrderResource($order),
                'payment_instructions' => null,
            ], 'Service order placed. We will confirm the price after inspecting your device.');

        } catch (\Exception $e) {
            DB::rollBack();
            return $this->serverError('Failed to create service order: ' . $e->getMessage());
        }
    }

    /**
     * GET /guest/orders/{orderNumber}
     * Track a guest order by order number + phone (for security).
     */
    public function trackOrder(Request $request, string $orderNumber): JsonResponse
    {
        $request->validate([
            'customer_phone' => 'required|string|max:20',
        ]);

        $order = Order::where('order_number', $orderNumber)
            ->where('customer_phone', $request->customer_phone)
            ->with([
                'items.product',
                'items.service',
                'paymentNotices',
                'division',
                'district',
                'area',
            ])
            ->first();

        if (!$order) {
            return $this->error('Order not found. Please check your order number and phone number.', 404);
        }

        return $this->success(new OrderResource($order));
    }

    /**
     * GET /guest/orders/session
     * Get all guest orders by session_id.
     */
    public function getSessionOrders(Request $request): JsonResponse
    {
        $sessionId = $request->header('X-Guest-Session-Id');

        if (!$sessionId) {
            return $this->success([]);
        }

        $orders = Order::where('session_id', $sessionId)
            ->whereNull('customer_id')
            ->with(['items.product', 'items.service', 'division', 'district', 'area'])
            ->latest()
            ->get();

        return $this->success(OrderResource::collection($orders));
    }

    /**
     * POST /guest/cart/merge
     * Merge guest cart into authenticated user's cart after login.
     */
    public function mergeCart(Request $request): JsonResponse
    {
        // This endpoint requires auth - the user just logged in  
        // and wants to merge their guest cart
        if (!$request->user()) {
            return $this->error('Authentication required', 401);
        }

        $request->validate([
            'session_id' => 'required|string|max:64',
        ]);

        $sessionId = $request->session_id;
        $user      = $request->user();

        $guestCarts = Cart::where('session_id', $sessionId)
            ->whereNull('user_id')
            ->with('activeItems')
            ->get();

        foreach ($guestCarts as $guestCart) {
            foreach ($guestCart->activeItems as $guestItem) {
                // Find or create user's cart for the same vendor
                $userCart = Cart::firstOrCreate([
                    'user_id'           => $user->id,
                    'vendor_profile_id' => $guestCart->vendor_profile_id,
                ]);

                // Merge item
                $existingItem = CartItem::where('cart_id', $userCart->id)
                    ->where('item_type', $guestItem->item_type)
                    ->where(
                        $guestItem->item_type === 'product' ? 'product_id' : 'service_id',
                        $guestItem->item_type === 'product' ? $guestItem->product_id : $guestItem->service_id
                    )
                    ->where('is_saved_for_later', false)
                    ->first();

                if ($existingItem) {
                    $existingItem->update(['quantity' => $existingItem->quantity + $guestItem->quantity]);
                } else {
                    CartItem::create([
                        'cart_id'    => $userCart->id,
                        'item_type'  => $guestItem->item_type,
                        'product_id' => $guestItem->product_id,
                        'service_id' => $guestItem->service_id,
                        'quantity'   => $guestItem->quantity,
                        'unit_price' => $guestItem->unit_price,
                        'notes'      => $guestItem->notes,
                    ]);
                }
            }

            // Delete guest cart after merge
            $guestCart->clearCart();
            $guestCart->delete();
        }

        return $this->success(null, 'Cart merged successfully');
    }
}
