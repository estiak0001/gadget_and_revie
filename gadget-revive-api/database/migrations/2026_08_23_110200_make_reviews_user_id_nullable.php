<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The public token-based feedback flow (FeedbackController) accepts submissions on orders
     * the original reviews schema didn't anticipate:
     *  - true guest orders — GuestController::placeOrder() legitimately leaves orders.customer_id
     *    null — so reviews.user_id (previously NOT NULL) must allow null too, or every guest-order
     *    feedback submission fails at the DB layer. Duplicate-submission protection for these rows
     *    is handled in the controller (by order_id + product_id) rather than the DB unique index,
     *    since MySQL treats NULLs as distinct and won't catch it there.
     *  - direct (non-marketplace) orders — orders.vendor_profile_id was already made nullable in
     *    2026_02_18_000001 (not every order routes through a vendor), but reviews.vendor_profile_id
     *    was never updated to match, so reviewing one of those orders would fail the same way.
     */
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->change();
            $table->unsignedBigInteger('vendor_profile_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
            $table->unsignedBigInteger('vendor_profile_id')->nullable(false)->change();
        });
    }
};
