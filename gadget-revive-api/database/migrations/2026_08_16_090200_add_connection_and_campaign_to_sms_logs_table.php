<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->foreignId('sms_connection_id')->nullable()->after('purpose')->constrained('sms_connections')->nullOnDelete();
            $table->foreignId('sms_campaign_id')->nullable()->after('sms_connection_id')->constrained('sms_campaigns')->nullOnDelete();
        });

        // 'purpose' was an enum without 'campaign' — widen it now that campaign sends log through
        // the same table (each recipient gets its own sms_logs row, same as every other purpose).
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->enum('purpose', ['otp', 'order_placed', 'order_status', 'campaign', 'test', 'other'])
                ->default('other')->change();
        });
    }

    public function down(): void
    {
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sms_connection_id');
            $table->dropConstrainedForeignId('sms_campaign_id');
            $table->enum('purpose', ['otp', 'order_placed', 'order_status', 'test', 'other'])->default('other')->change();
        });
    }
};
