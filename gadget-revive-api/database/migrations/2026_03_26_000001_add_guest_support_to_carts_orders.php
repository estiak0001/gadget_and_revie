<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add session_id to carts so guests can have a cart
        Schema::table('carts', function (Blueprint $table) {
            $table->string('session_id')->nullable()->after('id');
            $table->unsignedBigInteger('user_id')->nullable()->change();
        });

        // Remove the unique constraint on user_id + vendor_profile_id 
        // (we need to handle this in application logic now)

        // Make customer_id nullable in orders (for guest orders)
        Schema::table('orders', function (Blueprint $table) {
            $table->string('session_id')->nullable()->after('order_number');
            $table->unsignedBigInteger('customer_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn('session_id');
            $table->unsignedBigInteger('user_id')->nullable(false)->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('session_id');
            $table->unsignedBigInteger('customer_id')->nullable(false)->change();
        });
    }
};
