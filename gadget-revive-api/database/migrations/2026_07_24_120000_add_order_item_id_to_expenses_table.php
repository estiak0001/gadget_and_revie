<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            // Links an expense back to the specific order line item it was incurred to
            // fulfill (e.g. outsourcing a repair, buying a part) — lets the order detail
            // page show revenue vs. cost vs. margin per item instead of cost floating
            // disconnected from the sale that generated it.
            $table->foreignId('order_item_id')->nullable()->after('expense_category_id')
                ->constrained('order_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('order_item_id');
        });
    }
};
