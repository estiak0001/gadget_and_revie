<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Cancelling an order that was never actually paid previously left payment_status stuck at
 * 'pending' (or whatever it was) forever -- the UI kept showing "pending payment" for an order
 * that will obviously never be paid now. Adds 'cancelled' as its own payment_status so a
 * cancelled, never-paid order reads correctly; a cancelled order that *had* been paid still goes
 * to 'refunded' as before (unchanged) -- see OrderController::cancel() and
 * AdminController::orderUpdateStatus().
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY payment_status ENUM('pending', 'awaiting_confirmation', 'partially_paid', 'paid', 'verified', 'failed', 'refunded', 'cancelled') DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE orders SET payment_status = 'pending' WHERE payment_status = 'cancelled'");
        DB::statement("ALTER TABLE orders MODIFY payment_status ENUM('pending', 'awaiting_confirmation', 'partially_paid', 'paid', 'verified', 'failed', 'refunded') DEFAULT 'pending'");
    }
};
