<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reviews were previously one-per-order (unique on order_id+user_id) with no product
     * association — fine for a single vendor rating, but an order can contain several products
     * and each needs its own review to show correctly on that product's own storefront page.
     * Adds a nullable product_id (null = a general/service review, not tied to one product) and
     * widens the uniqueness to order_id+user_id+product_id so one order can carry a separate
     * review per product instead of just one overall review.
     */
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->foreignId('product_id')->nullable()->after('order_id')->constrained('products')->nullOnDelete();
        });

        Schema::table('reviews', function (Blueprint $table) {
            // Add the new composite unique before dropping the old one, not after — the old
            // order_id+user_id unique index is what's silently backing order_id's own foreign
            // key (no separate index was ever created for it), so dropping it first fails with
            // "Cannot drop index ... needed in a foreign key constraint". Since the new index
            // also starts with order_id, creating it first hands MySQL a replacement to fall
            // back on before the old one goes away.
            $table->unique(['order_id', 'user_id', 'product_id']);
            $table->dropUnique('reviews_order_id_user_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unique(['order_id', 'user_id']);
            $table->dropUnique(['order_id', 'user_id', 'product_id']);
        });

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
        });
    }
};
