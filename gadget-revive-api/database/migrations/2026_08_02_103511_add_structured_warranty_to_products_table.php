<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedSmallInteger('warranty_value')->nullable()->after('warranty');
            $table->string('warranty_unit')->nullable()->after('warranty_value');
        });

        // One-time backfill: the existing free-text 'warranty' column stays as-is (relabeled
        // "Warranty Notes" in the UI), but wherever it clearly contains "<number> <unit>" we also
        // populate the new structured fields so existing data isn't just abandoned. Anything
        // ambiguous (a bare number, "Lifetime", etc.) is left null for manual entry — the original
        // text is never touched either way.
        DB::table('products')
            ->whereNotNull('warranty')
            ->where('warranty', '!=', '')
            ->orderBy('id')
            ->select('id', 'warranty')
            ->chunkById(200, function ($products) {
                foreach ($products as $product) {
                    if (!preg_match('/(\d+)\s*(day|week|month|year)/i', $product->warranty, $m)) {
                        continue;
                    }
                    DB::table('products')->where('id', $product->id)->update([
                        'warranty_value' => (int) $m[1],
                        'warranty_unit' => strtolower($m[2]),
                    ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['warranty_value', 'warranty_unit']);
        });
    }
};
