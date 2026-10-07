<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Problem type is per-item (like problem_reported/serial_number already are) -- a single intake
 * can have one device needing recovery and another needing repair.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_intake_items', function (Blueprint $table) {
            $table->foreignId('problem_type_id')->nullable()->after('problem_reported')
                ->constrained('service_problem_types')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('service_intake_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('problem_type_id');
        });
    }
};
