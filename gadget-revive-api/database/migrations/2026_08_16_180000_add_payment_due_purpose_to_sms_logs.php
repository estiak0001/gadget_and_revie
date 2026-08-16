<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Payment-due reminders are a fourth manually-triggered order/billing SMS type (alongside
     * delivered and custom-invoice — see the previous migration's note on why these are separate
     * from the two automatic ones, order_placed and order_status).
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE sms_logs MODIFY purpose ENUM('otp', 'order_placed', 'order_status', 'order_delivered', 'custom_invoice', 'payment_due', 'campaign', 'test', 'other') NOT NULL DEFAULT 'other'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE sms_logs MODIFY purpose ENUM('otp', 'order_placed', 'order_status', 'order_delivered', 'custom_invoice', 'campaign', 'test', 'other') NOT NULL DEFAULT 'other'");
    }
};
