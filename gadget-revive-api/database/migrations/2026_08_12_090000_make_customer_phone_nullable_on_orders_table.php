<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Every validation rule for customer_phone (orderCreate, orderUpdate, the custom
            // invoice endpoint) has always been `nullable`, and the admin order form deliberately
            // treats it as optional ("Name and phone are both optional — nothing blocks saving") —
            // but this column was left NOT NULL from the original create_orders_table migration,
            // which only ever expected customer-facing checkout traffic where a phone number was
            // mandatory. Leaving it blank on an admin-created order (walk-in customers, custom/
            // manual orders in particular) currently throws a raw 500 Integrity constraint
            // violation instead of saving. Mirrors the identical fix already applied to
            // vendor_profile_id on this same table
            // (2026_02_18_000001_make_vendor_profile_id_nullable_on_orders_table.php).
            $table->string('customer_phone')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('customer_phone')->nullable(false)->change();
        });
    }
};
