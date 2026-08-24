<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The general/"kiosk" feedback link (FeedbackController::submitGeneral) is a store-wide
     * rating with no specific order behind it at all — a tablet left at the counter for any
     * walk-in customer to rate their overall experience, distinct from the order-specific
     * feedback flow. reviews.order_id was NOT NULL (every prior review came from a real order),
     * so this makes it nullable to allow that anonymous, order-less kind of review too.
     */
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unsignedBigInteger('order_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unsignedBigInteger('order_id')->nullable(false)->change();
        });
    }
};
