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
        Schema::create('product_serials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('serial_number');
            $table->enum('status', ['in_stock', 'sold', 'returned'])->default('in_stock');
            // Provenance: which PO receipt brought this unit in (null when backfilled manually
            // via the product edit screen for stock that predates serial tracking).
            $table->foreignId('purchase_order_item_id')->nullable()->constrained()->nullOnDelete();
            // Set the moment this unit is sold on an order; cleared back to null (and status
            // reset to in_stock) if that order item is later removed/refunded/edited away.
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['product_id', 'serial_number']);
            $table->index(['product_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_serials');
    }
};
