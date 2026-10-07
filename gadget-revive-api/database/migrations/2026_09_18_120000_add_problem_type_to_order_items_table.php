<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors service_intake_items.problem_type_id (see
 * 2026_09_04_163634_add_problem_type_to_service_intake_items_table.php) so the type
 * (Repair, Recovery, ...) picked at intake survives the copy into an order's line
 * items -- ServiceIntakeController::convertToOrder()/confirmPrice() -- and can be
 * shown on the order invoice, not just the service receipt.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('problem_type_id')->nullable()->after('notes')
                ->constrained('service_problem_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('problem_type_id');
        });
    }
};
