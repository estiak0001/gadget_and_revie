<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE inventory_logs MODIFY type ENUM('addition', 'deduction', 'adjustment', 'sale', 'return', 'return_to_supplier')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE inventory_logs MODIFY type ENUM('addition', 'deduction', 'adjustment', 'sale', 'return')");
    }
};
