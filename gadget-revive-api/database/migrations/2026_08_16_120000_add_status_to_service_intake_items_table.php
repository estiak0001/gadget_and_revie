<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_intake_items', function (Blueprint $table) {
            // Per-item disposition when the intake is converted — not every item necessarily goes
            // into the resulting order (e.g. 2 items received, 1 is being handed back to the
            // customer as-is and only the other becomes a paid order line). 'pending' until the
            // intake is converted, then each item lands on 'converted' or 'returned' depending on
            // whether the admin included it.
            $table->enum('status', ['pending', 'converted', 'returned'])->default('pending')->after('estimated_price');
        });
    }

    public function down(): void
    {
        Schema::table('service_intake_items', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
