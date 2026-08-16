<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Two more manually-triggered admin actions now log through sms_logs: sending a "your order
     * has been delivered" SMS (a deliberate manual button, not tied to any order_status change —
     * there's no 'delivered' status in this system, delivery is a real-world event only the admin
     * knows happened) and sending a custom invoice's own SMS. Both need their own purpose value
     * so the admin can filter the log/usage breakdown by them distinctly from the generic
     * order_placed/order_status sends.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE sms_logs MODIFY purpose ENUM('otp', 'order_placed', 'order_status', 'order_delivered', 'custom_invoice', 'campaign', 'test', 'other') NOT NULL DEFAULT 'other'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE sms_logs MODIFY purpose ENUM('otp', 'order_placed', 'order_status', 'campaign', 'test', 'other') NOT NULL DEFAULT 'other'");
    }
};
