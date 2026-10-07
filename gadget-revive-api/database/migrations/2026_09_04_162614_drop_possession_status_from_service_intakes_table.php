<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `possession_status` (Receive/Return/DRP) turned out unnecessary alongside the existing
 * `status` lifecycle column -- removed. `status` is the only status field again.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->dropColumn('possession_status');
        });
    }

    public function down(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->string('possession_status', 20)->default('receive')->after('status');
        });
    }
};
