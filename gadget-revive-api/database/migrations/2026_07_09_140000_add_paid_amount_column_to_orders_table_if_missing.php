<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The earlier migration (2026_07_08_084049) assumed `paid_amount` already existed on every
     * environment because it did on the one it was tested against. That assumption was wrong for
     * this production database, which never had the column — recordPayment() was crashing with
     * "Unknown column 'paid_amount'". This migration actually creates it, guarded so it's a no-op
     * on any environment where the column is already present.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('orders', 'paid_amount')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->decimal('paid_amount', 12, 2)->default(0)->after('refund_amount');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'paid_amount')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('paid_amount');
            });
        }
    }
};
