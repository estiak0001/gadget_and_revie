<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The orders.order_status DB column has only ever had 8 values (see the original
 * create_orders_table migration), but both the admin's order-status dropdown
 * (gadget-revive-admin ORDER_STATUSES) and this API's own validation
 * (AdminController::orderCreate()/orderUpdateStatus()) have offered 'confirmed' and
 * 'processing' as selectable values all along -- picking either would pass validation and then
 * fail at the DB layer (ENUM constraint violation) the moment it was actually saved. Widens the
 * column to match what the app already presents as real options.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY order_status ENUM('pending', 'accepted', 'confirmed', 'rejected', 'in_progress', 'processing', 'awaiting_payment', 'completed', 'cancelled', 'refunded') DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE orders SET order_status = 'accepted' WHERE order_status = 'confirmed'");
        DB::statement("UPDATE orders SET order_status = 'in_progress' WHERE order_status = 'processing'");
        DB::statement("ALTER TABLE orders MODIFY order_status ENUM('pending', 'accepted', 'rejected', 'in_progress', 'awaiting_payment', 'completed', 'cancelled', 'refunded') DEFAULT 'pending'");
    }
};
