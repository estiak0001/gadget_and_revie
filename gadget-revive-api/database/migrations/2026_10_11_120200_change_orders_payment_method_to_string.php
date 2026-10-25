<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * payment_method was a fixed 4-value enum (bkash, nagad, cash, bank_transfer) — now that payment
 * methods are a real, addable entity (see create_payment_methods_table), a 5th method (another
 * bank account, a card reader, etc.) must not be blocked by the old enum at the schema level.
 * The 4 existing values still work unchanged; this only removes the ceiling on adding more.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY payment_method VARCHAR(50) NOT NULL DEFAULT 'cash'");
    }

    public function down(): void
    {
        // Any value added after this migration ran (a 5th+ payment method) has no enum slot to
        // revert into — leave the data as-is and only revert the column's shape, same approach as
        // 2026_10_04_090000_add_cancelled_to_orders_payment_status_enum.php.
        DB::statement("ALTER TABLE orders MODIFY payment_method ENUM('bkash', 'nagad', 'cash', 'bank_transfer') NOT NULL DEFAULT 'cash'");
    }
};
