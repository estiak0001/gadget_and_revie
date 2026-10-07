<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `engineer_name` was meant as "who will service this device" -- wrong concept. This column is
 * actually "who received this intake at the desk", which defaults to whoever is logged in when
 * the intake is created (see ServiceIntakeController::store()) but stays editable/correctable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->renameColumn('engineer_name', 'received_by_name');
        });
    }

    public function down(): void
    {
        Schema::table('service_intakes', function (Blueprint $table) {
            $table->renameColumn('received_by_name', 'engineer_name');
        });
    }
};
