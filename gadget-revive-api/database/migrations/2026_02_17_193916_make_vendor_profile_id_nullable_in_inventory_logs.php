<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('inventory_logs', function (Blueprint $table) {
            // Drop the existing foreign key constraint first
            $table->dropForeign(['vendor_profile_id']);
            
            // Make vendor_profile_id nullable
            $table->foreignId('vendor_profile_id')->nullable()->change();
            
            // Re-add the foreign key constraint with nullable support
            $table->foreign('vendor_profile_id')
                  ->references('id')
                  ->on('vendor_profiles')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_logs', function (Blueprint $table) {
            $table->dropForeign(['vendor_profile_id']);
            
            $table->foreignId('vendor_profile_id')->nullable(false)->change();
            
            $table->foreign('vendor_profile_id')
                  ->references('id')
                  ->on('vendor_profiles')
                  ->onDelete('cascade');
        });
    }
};
