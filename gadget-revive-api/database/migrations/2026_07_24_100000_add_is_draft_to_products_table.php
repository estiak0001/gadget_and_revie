<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // True for products quick-created inline from the Order/Purchase Order forms
            // (minimal fields only, always paired with is_active=false). Distinguishes
            // "still needs cataloging" from an ordinary, intentionally deactivated product —
            // is_active alone can't tell those two cases apart. Cleared automatically the
            // next time the product is saved through the normal product edit form.
            $table->boolean('is_draft')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_draft');
        });
    }
};
