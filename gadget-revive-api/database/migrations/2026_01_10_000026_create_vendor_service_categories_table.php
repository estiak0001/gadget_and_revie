<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Vendor to Service Categories (many-to-many for services vendor offers)
        Schema::create('vendor_service_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_profile_id')->constrained()->onDelete('cascade');
            $table->foreignId('service_category_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            $table->unique(['vendor_profile_id', 'service_category_id'], 'vendor_service_cat_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_service_categories');
    }
};
