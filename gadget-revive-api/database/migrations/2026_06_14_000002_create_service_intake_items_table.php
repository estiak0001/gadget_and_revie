<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Individual devices/items received under a service intake — each with its
     * serial number, the problem reported by the customer, and an optional
     * estimated price.
     */
    public function up(): void
    {
        Schema::create('service_intake_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_intake_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_name');
            $table->string('serial_number')->nullable();
            $table->text('problem_reported')->nullable();
            $table->string('accessories')->nullable();
            $table->text('condition_notes')->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('estimated_price', 10, 2)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_intake_items');
    }
};
