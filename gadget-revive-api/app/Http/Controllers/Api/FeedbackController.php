<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public, no-login feedback flow reached via the {feedback_url} link texted from the order
 * detail page (SmsService::sendFeedbackRequest() / Order::getOrCreateFeedbackToken()). The
 * token itself is the access control, same convention as InvoiceController::shortDownload() —
 * not who's logged in, since the customer may well be a guest with no account at all.
 */
class FeedbackController extends BaseController
{
    /** What the feedback page needs to render: the order's product line items, each flagged
     *  with whether it already has a review attached (so a re-opened link shows "already
     *  submitted" instead of a blank form re-prompting the customer). */
    public function show(string $token): JsonResponse
    {
        $order = $this->findByToken($token);
        if (!$order) {
            return $this->notFound('This feedback link is invalid or has expired.');
        }

        $order->load(['items.product:id,name,image', 'reviews']);

        $reviewedProductIds = $order->reviews->pluck('product_id')->filter()->all();

        $products = $order->items
            ->where('item_type', 'product')
            ->filter(fn ($item) => $item->product !== null)
            ->unique('product_id')
            ->values()
            ->map(fn ($item) => [
                'product_id' => $item->product_id,
                'name' => $item->product->name,
                'image' => $item->product->image ? asset('storage/' . $item->product->image) : null,
                'already_reviewed' => in_array($item->product_id, $reviewedProductIds),
            ]);

        return $this->success([
            'order_number' => $order->order_number,
            'already_submitted' => $order->reviews->isNotEmpty(),
            'products' => $products,
        ]);
    }

    /**
     * Accepts one rating (+ optional comment) per product line item, plus an overall rating
     * used when the order has no product items at all (a pure service order — reviews.product_id
     * stays null for that one, same as the pre-existing vendor-wide review shape). Every review
     * lands as status='pending' — nothing appears on the storefront until an admin approves it
     * on the Reviews moderation page (AdminController::reviewModerate).
     */
    public function store(Request $request, string $token): JsonResponse
    {
        $order = $this->findByToken($token);
        if (!$order) {
            return $this->notFound('This feedback link is invalid or has expired.');
        }

        if ($order->reviews()->exists()) {
            return $this->error('Feedback has already been submitted for this order.', 422);
        }

        $request->validate([
            'reviews' => 'required|array|min:1',
            'reviews.*.product_id' => 'nullable|integer',
            'reviews.*.rating' => 'required|integer|min:1|max:5',
            'reviews.*.review' => 'nullable|string|max:1000',
        ]);

        $orderProductIds = $order->items()
            ->where('item_type', 'product')
            ->pluck('product_id')
            ->all();

        $created = [];
        foreach ($request->input('reviews') as $entry) {
            $productId = $entry['product_id'] ?? null;

            // Only accept a product_id that's actually a line item on this order — the token
            // grants access to this order's own feedback, not an arbitrary product review.
            if ($productId !== null && !in_array((int) $productId, $orderProductIds)) {
                continue;
            }

            $created[] = Review::create([
                'order_id' => $order->id,
                'product_id' => $productId,
                'user_id' => $order->customer_id,
                'vendor_profile_id' => $order->vendor_profile_id,
                'rating' => $entry['rating'],
                'review' => $entry['review'] ?? null,
                'status' => 'pending',
            ]);
        }

        if (empty($created)) {
            return $this->error('No valid feedback items were submitted.', 422);
        }

        AuditLog::log(null, 'submit_feedback', 'Order', $order->id, null, [
            'review_ids' => collect($created)->pluck('id')->all(),
        ], "Feedback submitted for order #{$order->order_number}");

        return $this->created(null, 'Thank you for your feedback!');
    }

    /**
     * The "kiosk" flow — a tablet left at the counter for any walk-in customer to rate their
     * overall experience, with no order/token behind it at all (see the general feedback page,
     * not /feedback/{token}). Fully anonymous: order_id/product_id/user_id/vendor_profile_id all
     * stay null on the created row — reviews.order_id was made nullable specifically for this.
     */
    public function submitGeneral(Request $request): JsonResponse
    {
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'would_recommend' => 'nullable|boolean',
            'review' => 'nullable|string|max:1000',
        ]);

        $review = Review::create([
            'rating' => $request->rating,
            'would_recommend' => $request->has('would_recommend') ? $request->boolean('would_recommend') : null,
            'review' => $request->review,
            'status' => 'pending',
        ]);

        AuditLog::log(null, 'submit_general_feedback', 'Review', $review->id, null, [
            'rating' => $review->rating,
        ], 'Walk-in kiosk feedback submitted');

        return $this->created(null, 'Thank you for your feedback!');
    }

    private function findByToken(string $token): ?Order
    {
        return Order::where('feedback_token', $token)->first();
    }
}
