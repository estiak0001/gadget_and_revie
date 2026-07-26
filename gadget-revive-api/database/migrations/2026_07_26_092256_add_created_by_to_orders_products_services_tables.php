<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('customer_id')->constrained('users')->nullOnDelete();
        });
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('vendor_profile_id')->constrained('users')->nullOnDelete();
        });
        Schema::table('services', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('vendor_profile_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
        Schema::table('services', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
