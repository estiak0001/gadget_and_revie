<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Non Refundable" started as a plain yes/no flag, but only PART of the collected `amount` is
 * typically non-refundable (e.g. a diagnostic/inspection charge already incurred) -- not the
 * whole thing, and always for a specific reason. Replaces the boolean with the two fields that
 * actually carry that: `non_refundable_amount` (how much of it) and `non_refundable_reason`
 * (why). A row now counts as "has a non-refundable charge" simply by having an amount set --
 * no separate flag to keep in sync with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->dropColumn('is_non_refundable');
            $table->decimal('non_refundable_amount', 10, 2)->nullable()->after('amount');
            $table->string('non_refundable_reason')->nullable()->after('non_refundable_amount');
        });
    }

    public function down(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->dropColumn(['non_refundable_amount', 'non_refundable_reason']);
            $table->boolean('is_non_refundable')->default(false)->after('amount');
        });
    }
};
