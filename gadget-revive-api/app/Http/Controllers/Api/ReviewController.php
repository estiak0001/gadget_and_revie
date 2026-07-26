<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\ReviewResource;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends BaseController
{
    /**
     * List reviews (admin: all, vendor: their reviews, customer: their reviews)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Review::with(['user', 'vendorProfile', 'order']);

        if ($user->isCustomer()) {
            $query->where('user_id', $user->id);
        } elseif ($user->isVendor() && $user->vendorProfile) {
            $query->where('vendor_profile_id', $user->vendorProfile->id);
        }

        // Filter by rating
        if ($request->has('rating')) {
            $query->where('rating', $request->rating);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $reviews = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($reviews);
    }

    /**
     * Get reviews for a specific vendor (public)
     */
    public function vendorReviews(Request $request, int $vendorId): JsonResponse
    {
        $query = Review::with(['user', 'order'])
            ->where('vendor_profile_id', $vendorId)
            ->approved();

        // Filter by rating
        if ($request->has('rating')) {
            $query->where('rating', $request->rating);
        }

        // Sort options
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        if (in_array($sortBy, ['created_at', 'rating', 'helpful_count'])) {
            $query->orderBy($sortBy, $sortOrder);
        }

        $reviews = $query->paginate($request->get('per_page', 15));

        // Get rating summary
        $ratingStats = Review::where('vendor_profile_id', $vendorId)
            ->approved()
            ->selectRaw('
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            ')
            ->first();

        return $this->success([
            'reviews' => ReviewResource::collection($reviews->items()),
            'pagination' => [
                'total' => $reviews->total(),
                'per_page' => $reviews->perPage(),
                'current_page' => $reviews->currentPage(),
                'last_page' => $reviews->lastPage(),
            ],
            'stats' => [
                'total_reviews' => (int) $ratingStats->total_reviews,
                'average_rating' => round($ratingStats->average_rating, 2),
                'rating_breakdown' => [
                    5 => (int) $ratingStats->five_star,
                    4 => (int) $ratingStats->four_star,
                    3 => (int) $ratingStats->three_star,
                    2 => (int) $ratingStats->two_star,
                    1 => (int) $ratingStats->one_star,
                ],
            ],
        ]);
    }

    /**
     * Create a new review
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'order_id' => 'required|exists:orders,id',
            'rating' => 'required|integer|min:1|max:5',
            'review' => 'required|string|max:1000',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|max:2048',
        ]);

        $user = $request->user();

        // Get order and verify ownership
        $order = Order::where('customer_id', $user->id)
            ->where('id', $request->order_id)
            ->first();

        if (!$order) {
            return $this->error('Order not found', 404);
        }

        // Check if order is completed
        if ($order->status !== 'completed') {
            return $this->error('You can only review completed orders', 400);
        }

        // Check if already reviewed
        $existingReview = Review::where('order_id', $order->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existingReview) {
            return $this->error('You have already reviewed this order', 400);
        }

        // Handle images
        $images = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $images[] = $image->store('review-images', 'public');
            }
        }

        // Create review
        $review = Review::create([
            'user_id' => $user->id,
            'vendor_profile_id' => $order->vendor_profile_id,
            'order_id' => $order->id,
            'rating' => $request->rating,
            'review' => $request->review,
            'images' => !empty($images) ? $images : null,
            'status' => 'approved', // Auto-approve or set to 'pending' if moderation needed
        ]);

        // Update vendor average rating
        $this->updateVendorRating($order->vendor_profile_id);

        // Log audit
        AuditLog::log($user, 'create_review', 'Review', $review->id, null, [
            'rating' => $review->rating,
            'vendor_id' => $order->vendor_profile_id,
        ], 'Review submitted');

        // Notify vendor
        if ($order->vendorProfile?->user) {
            Notification::notify(
                $order->vendorProfile->user,
                'new_review',
                'New Review Received',
                "You received a {$review->rating}-star review for order #{$order->order_number}",
                ['review_id' => $review->id, 'order_id' => $order->id],
                "/vendor/reviews/{$review->id}"
            );
        }

        return $this->created(new ReviewResource($review->load(['user', 'vendorProfile'])), 'Review submitted successfully');
    }

    /**
     * Update a review (customer can edit their own review)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'rating' => 'sometimes|integer|min:1|max:5',
            'review' => 'sometimes|string|max:1000',
        ]);

        $user = $request->user();

        $review = Review::where('user_id', $user->id)->findOrFail($id);

        // Check if review can be edited (within 7 days)
        if ($review->created_at->diffInDays(now()) > 7) {
            return $this->error('Reviews can only be edited within 7 days of submission', 400);
        }

        $oldData = $review->only(['rating', 'review']);

        $review->update($request->only(['rating', 'review']));

        // Update vendor rating if rating changed
        if ($request->has('rating')) {
            $this->updateVendorRating($review->vendor_profile_id);
        }

        AuditLog::log($user, 'update_review', 'Review', $review->id, $oldData, $review->only(['rating', 'review']), 'Review updated');

        return $this->success(new ReviewResource($review->fresh(['user', 'vendorProfile'])), 'Review updated');
    }

    /**
     * Delete a review (customer can delete their own)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $review = Review::where('user_id', $user->id)->findOrFail($id);

        $vendorId = $review->vendor_profile_id;

        AuditLog::log($user, 'delete_review', 'Review', $review->id, $review->toArray(), null, 'Review deleted');

        $review->delete();

        // Update vendor rating
        $this->updateVendorRating($vendorId);

        return $this->success(null, 'Review deleted');
    }

    /**
     * Vendor responds to a review
     */
    public function respond(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'response' => 'required|string|max:500',
        ]);

        $user = $request->user();

        if (!$user->isVendor() || !$user->vendorProfile) {
            return $this->error('Unauthorized', 403);
        }

        $review = Review::where('vendor_profile_id', $user->vendorProfile->id)
            ->findOrFail($id);

        if ($review->vendor_response) {
            return $this->error('You have already responded to this review', 400);
        }

        $review->update([
            'vendor_response' => $request->response,
            'vendor_responded_at' => now(),
        ]);

        AuditLog::log($user, 'respond_review', 'Review', $review->id, null, [
            'response' => $request->response,
        ], 'Vendor responded to review');

        // Notify customer
        Notification::notify(
            $review->user,
            'review_response',
            'Vendor Responded to Your Review',
            "The vendor responded to your review for order #{$review->order->order_number}",
            ['review_id' => $review->id],
            "/reviews/{$review->id}"
        );

        return $this->success(new ReviewResource($review->fresh(['user', 'vendorProfile'])), 'Response added');
    }

    /**
     * Mark a review as helpful
     */
    public function markHelpful(Request $request, int $id): JsonResponse
    {
        $review = Review::approved()->findOrFail($id);

        $review->increment('helpful_count');

        return $this->success(['helpful_count' => $review->helpful_count], 'Marked as helpful');
    }

    /**
     * Update vendor's average rating
     */
    protected function updateVendorRating(int $vendorProfileId): void
    {
        $stats = Review::where('vendor_profile_id', $vendorProfileId)
            ->approved()
            ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as total_reviews')
            ->first();

        \App\Models\VendorProfile::where('id', $vendorProfileId)->update([
            'average_rating' => round($stats->avg_rating ?? 0, 2),
            'total_reviews' => $stats->total_reviews ?? 0,
        ]);
    }
}
