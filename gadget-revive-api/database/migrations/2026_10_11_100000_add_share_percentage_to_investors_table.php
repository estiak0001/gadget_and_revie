<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            // Ownership share — set by hand on the Investors page, not derived from the capital
            // balance ratio. A business's actual equity split doesn't have to track dollar amounts
            // 1:1 (sweat equity, founder shares, negotiated terms, etc.), so this is deliberately
            // a separate, independent field an admin fills in rather than a computed column.
            $table->decimal('share_percentage', 6, 3)->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('investors', function (Blueprint $table) {
            $table->dropColumn('share_percentage');
        });
    }
};
