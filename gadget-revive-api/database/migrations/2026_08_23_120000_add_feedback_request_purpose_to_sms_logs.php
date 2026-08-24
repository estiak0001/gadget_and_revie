<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Fifth manually-triggered order/billing SMS type — the "Request Feedback" button on the
     * order detail page (SmsService::sendFeedbackRequest()). Without this, inserting a
     * sms_logs row with purpose='feedback_request' fails: the column is a real MySQL ENUM.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE sms_logs MODIFY purpose ENUM('otp', 'order_placed', 'order_status', 'order_delivered', 'custom_invoice', 'payment_due', 'feedback_request', 'campaign', 'test', 'other') NOT NULL DEFAULT 'other'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE sms_logs MODIFY purpose ENUM('otp', 'order_placed', 'order_status', 'order_delivered', 'custom_invoice', 'payment_due', 'campaign', 'test', 'other') NOT NULL DEFAULT 'other'");
    }
};
