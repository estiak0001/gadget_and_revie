<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * products.sku/slug had plain DB-level unique constraints, which don't know about
     * SoftDeletes — a UNIQUE index enforces uniqueness across *every* row regardless of
     * deleted_at, so a soft-deleted product permanently blocks reusing its SKU, even though
     * every app-level duplicate check (ProductBulkImport, the admin product-create/update
     * validation) already correctly treats a soft-deleted row's SKU as free. Confirmed live via
     * the bulk-upload feature: an admin bulk-uploaded a catalog, deleted one product, then
     * re-uploaded the same file — the second upload hit a raw 500 (1062 Duplicate entry ...
     * 'products_sku_unique') instead of either succeeding or reporting a clean duplicate.
     *
     * Same fix as 2026_08_22_120000_drop_unique_constraints_from_product_brands.php: drop the
     * unique constraints in favor of plain indexes for lookup performance, and enforce
     * uniqueness among live products purely at the application layer
     * (Rule::unique(...)->whereNull('deleted_at') in AdminController; ProductBulkImport's
     * ->exists() checks are already soft-delete-aware via Eloquent's default scope).
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropUnique('products_sku_unique');
            $table->dropUnique('products_slug_unique');
            $table->index('sku');
            $table->index('slug');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['sku']);
            $table->dropIndex(['slug']);
            $table->unique('sku');
            $table->unique('slug');
        });
    }
};
