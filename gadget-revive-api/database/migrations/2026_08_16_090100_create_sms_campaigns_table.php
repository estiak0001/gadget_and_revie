<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('message');
            $table->foreignId('sms_connection_id')->nullable()->constrained('sms_connections')->nullOnDelete();
            // 'all_customers' | 'manual' — how the recipient list was built, kept for reference
            // even though the actual numbers dialed are only in sms_logs (one row per recipient).
            $table->string('recipient_source', 20)->default('manual');
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            // Sent synchronously within the request (no queue worker runs in this deployment — see
            // deployment.md — so there is no 'scheduled'/'sending' in-progress state to track).
            $table->enum('status', ['completed', 'failed'])->default('completed');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_campaigns');
    }
};
