<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * product_brands.name/slug had plain DB-level unique constraints, which don't know about
     * SoftDeletes — a UNIQUE index enforces uniqueness across *every* row regardless of
     * deleted_at, so a soft-deleted brand ("Seagate") permanently blocked recreating a brand
     * with that name, even after the app-level validation was fixed to ignore trashed rows
     * (confirmed live: 1062 Duplicate entry 'Seagate' for key product_brands_name_unique).
     * Drop the unique constraints in favor of plain indexes for lookup performance — uniqueness
     * among live brands is now enforced purely at the application layer
     * (Rule::unique(...)->whereNull('deleted_at') in AdminController), which is aware of
     * soft-deletes. This is the standard fix for the well-known soft-delete + unique-index
     * conflict; the traffic/concurrency profile here (single-admin brand management) makes the
     * tiny theoretical race window an acceptable trade-off.
     */
    public function up(): void
    {
        Schema::table('product_brands', function (Blueprint $table) {
            $table->dropUnique('product_brands_name_unique');
            $table->dropUnique('product_brands_slug_unique');
            $table->index('name');
            $table->index('slug');
        });
    }

    public function down(): void
    {
        Schema::table('product_brands', function (Blueprint $table) {
            $table->dropIndex(['name']);
            $table->dropIndex(['slug']);
            $table->unique('name');
            $table->unique('slug');
        });
    }
};
