<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the extra front-desk tracking fields the intake table/form need, alongside (not
 * replacing) the existing `status` lifecycle column:
 *  - `possession_status` (receive|return|drp) -- physically, where the device currently sits.
 *    Deliberately a separate column from `status` (received|in_progress|ready|converted|
 *    delivered|cancelled), which drives order-conversion logic elsewhere and must not change
 *    meaning.
 *  - `work_status` (pending|in_progress|wait_for_feedback|done) -- repair-work progress, also
 *    independent of both `status` and `possession_status`.
 *  - `engineer_name` -- plain text, not a user_id FK: the technician working on a device isn't
 *    necessarily a system user with a login.
 *  - `customer_feedback`, `is_non_refundable`, `amount` -- self-explanatory front-desk fields.
 * "Remark" reuses the existing `admin_notes` column; "Days" (vs. the estimated delivery date)
 * is computed from `expected_delivery_at`, not stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->string('engineer_name')->nullable()->after('customer_address');
            $table->string('possession_status', 20)->default('receive')->after('status');
            $table->string('work_status', 20)->default('pending')->after('possession_status');
            $table->decimal('amount', 10, 2)->nullable()->after('estimated_cost');
            $table->boolean('is_non_refundable')->default(false)->after('amount');
            $table->text('customer_feedback')->nullable()->after('admin_notes');
        });
    }

    public function down(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->dropColumn([
                'engineer_name', 'possession_status', 'work_status',
                'amount', 'is_non_refundable', 'customer_feedback',
            ]);
        });
    }
};
