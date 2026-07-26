<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\CartResource;
use App\Http\Resources\CartItemResource;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends BaseController
{
    public function index(Request $request): JsonResponse
    {
        $carts = Cart::where('user_id', $request->user()->id)
            ->with([
                'vendorProfile',
                'activeItems.product.category',
                'activeItems.service.category',
                'savedItems.product.category',
                'savedItems.service.category',
            ])
            ->get();

        return $this->success(CartResource::collection($carts));
    }

    public function addItem(Request $request): JsonResponse
    {
        $request->validate([
            'item_type' => 'required|in:product,service',
            'product_id' => 'required_if:item_type,product|exists:products,id',
            'service_id' => 'required_if:item_type,service|exists:services,id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $itemType = $request->item_type;

        // Get item and validate
        if ($itemType === 'product') {
            $item = Product::findOrFail($request->product_id);
            $vendorProfileId = $item->vendor_profile_id;
            $unitPrice = $item->getCurrentPrice();

            // Check stock
            if (!$item->canFulfill($request->quantity)) {
                return $this->error('Not enough stock available. Available: ' . $item->stock_qty, 400);
            }
        } else {
            $item = Service::findOrFail($request->service_id);
            $vendorProfileId = $item->vendor_profile_id;
            $unitPrice = $item->getCurrentPrice();
        }

        // Get or create cart for this vendor
        $cart = Cart::firstOrCreate([
            'user_id' => $user->id,
            'vendor_profile_id' => $vendorProfileId,
        ]);

        // Check if item already in cart
        $existingItem = CartItem::where('cart_id', $cart->id)
            ->where('item_type', $itemType)
            ->where($itemType === 'product' ? 'product_id' : 'service_id', $item->id)
            ->where('is_saved_for_later', false)
            ->first();

        if ($existingItem) {
            $newQuantity = $existingItem->quantity + $request->quantity;

            // Check stock for products
            if ($itemType === 'product' && !$item->canFulfill($newQuantity)) {
                return $this->error('Not enough stock available. Available: ' . $item->stock_qty, 400);
            }

            $existingItem->update([
                'quantity' => $newQuantity,
                'unit_price' => $unitPrice,
            ]);

            $cartItem = $existingItem;
        } else {
            $cartItem = CartItem::create([
                'cart_id' => $cart->id,
                'item_type' => $itemType,
                'product_id' => $itemType === 'product' ? $item->id : null,
                'service_id' => $itemType === 'service' ? $item->id : null,
                'quantity' => $request->quantity,
                'unit_price' => $unitPrice,
                'notes' => $request->notes,
            ]);
        }

        $cart->load([
            'vendorProfile',
            'activeItems.product.category',
            'activeItems.service.category',
        ]);

        return $this->success(new CartResource($cart), 'Item added to cart');
    }

    public function updateItem(Request $request, int $itemId): JsonResponse
    {
        $request->validate([
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string|max:500',
        ]);

        $cartItem = CartItem::whereHas('cart', function ($query) use ($request) {
            $query->where('user_id', $request->user()->id);
        })->findOrFail($itemId);

        // Check stock for products
        if ($cartItem->item_type === 'product') {
            $product = $cartItem->product;
            if (!$product->canFulfill($request->quantity)) {
                return $this->error('Not enough stock available. Available: ' . $product->stock_qty, 400);
            }
        }

        $cartItem->update([
            'quantity' => $request->quantity,
            'notes' => $request->notes ?? $cartItem->notes,
        ]);

        return $this->success(new CartItemResource($cartItem), 'Cart item updated');
    }

    public function removeItem(Request $request, int $itemId): JsonResponse
    {
        $cartItem = CartItem::whereHas('cart', function ($query) use ($request) {
            $query->where('user_id', $request->user()->id);
        })->findOrFail($itemId);

        $cart = $cartItem->cart;
        $cartItem->delete();

        // Delete cart if empty
        if ($cart->items()->count() === 0) {
            $cart->delete();
        }

        return $this->success(null, 'Item removed from cart');
    }

    public function saveForLater(Request $request, int $itemId): JsonResponse
    {
        $cartItem = CartItem::whereHas('cart', function ($query) use ($request) {
            $query->where('user_id', $request->user()->id);
        })->findOrFail($itemId);

        $cartItem->update(['is_saved_for_later' => true]);

        return $this->success(new CartItemResource($cartItem), 'Item saved for later');
    }

    public function moveToCart(Request $request, int $itemId): JsonResponse
    {
        $cartItem = CartItem::whereHas('cart', function ($query) use ($request) {
            $query->where('user_id', $request->user()->id);
        })->findOrFail($itemId);

        // Check stock for products
        if ($cartItem->item_type === 'product') {
            $product = $cartItem->product;
            if (!$product->canFulfill($cartItem->quantity)) {
                return $this->error('Not enough stock available. Available: ' . $product->stock_qty, 400);
            }
        }

        $cartItem->update(['is_saved_for_later' => false]);

        return $this->success(new CartItemResource($cartItem), 'Item moved to cart');
    }

    public function clearCart(Request $request, int $cartId): JsonResponse
    {
        $cart = Cart::where('user_id', $request->user()->id)
            ->findOrFail($cartId);

        $cart->clearCart();

        // Delete cart if no saved items
        if ($cart->items()->count() === 0) {
            $cart->delete();
        }

        return $this->success(null, 'Cart cleared');
    }

    public function getCartSummary(Request $request): JsonResponse
    {
        $carts = Cart::where('user_id', $request->user()->id)
            ->with(['activeItems', 'vendorProfile'])
            ->get();

        $summary = [
            'total_items' => 0,
            'total_amount' => 0,
            'carts_count' => $carts->count(),
            'carts' => [],
        ];

        foreach ($carts as $cart) {
            $cartTotal = $cart->getSubtotal();
            $itemCount = $cart->getTotalItems();

            $summary['total_items'] += $itemCount;
            $summary['total_amount'] += $cartTotal;
            $summary['carts'][] = [
                'cart_id' => $cart->id,
                'vendor_id' => $cart->vendor_profile_id,
                'vendor_name' => $cart->vendorProfile->business_name,
                'items_count' => $itemCount,
                'subtotal' => $cartTotal,
            ];
        }

        return $this->success($summary);
    }
}
