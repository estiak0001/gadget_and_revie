<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Note: `paid_amount` (decimal 12,2, default 0) already exists on this table — it was
        // added directly on the live database ahead of any migration file, with no application
        // code ever using it. This migration just adds the 'partially_paid' status; it keeps the
        // existing 'verified' value too since live rows already use it.
        DB::statement("ALTER TABLE orders MODIFY payment_status ENUM('pending', 'awaiting_confirmation', 'partially_paid', 'paid', 'verified', 'failed', 'refunded') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("UPDATE orders SET payment_status = 'pending' WHERE payment_status = 'partially_paid'");
        DB::statement("ALTER TABLE orders MODIFY payment_status ENUM('pending', 'awaiting_confirmation', 'paid', 'verified', 'failed', 'refunded') DEFAULT 'pending'");
    }
};
