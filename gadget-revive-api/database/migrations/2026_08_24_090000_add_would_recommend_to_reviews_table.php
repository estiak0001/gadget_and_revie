<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Second quick-tap question on the general kiosk feedback flow ("Would you recommend us?"),
     * alongside the star rating — nullable since it's only ever answered there, never on the
     * per-product order feedback flow.
     */
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->boolean('would_recommend')->nullable()->after('rating');
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropColumn('would_recommend');
        });
    }
};
