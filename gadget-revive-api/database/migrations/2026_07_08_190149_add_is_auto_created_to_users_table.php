<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // True for customer accounts silently created by the system (e.g. a guest checkout,
            // or an admin typing customer details into a manual order) rather than self-registered.
            // Lets guest-style access (order tracking, invoice/receipt download by order number)
            // keep working for these accounts even after they're linked to a real order.customer_id.
            $table->boolean('is_auto_created')->default(false)->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_auto_created');
        });
    }
};
