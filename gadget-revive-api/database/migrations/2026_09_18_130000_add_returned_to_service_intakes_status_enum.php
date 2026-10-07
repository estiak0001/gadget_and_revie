<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds 'returned' to service_intakes.status -- the device was handed back to the customer
 * without ever being converted to a paid order (e.g. the quote was declined, or the item
 * turned out unrepairable). Distinct from 'cancelled' (the intake itself was called off,
 * usually before any real work) and from 'delivered' (a completed, paid repair handed back).
 * A plain ALTER ... MODIFY since Laravel's schema builder has no first-class "add an enum
 * value" operation.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE service_intakes MODIFY COLUMN status ENUM('received', 'in_progress', 'ready', 'converted', 'delivered', 'cancelled', 'returned') NOT NULL DEFAULT 'received'");
    }

    public function down(): void
    {
        DB::statement("UPDATE service_intakes SET status = 'cancelled' WHERE status = 'returned'");
        DB::statement("ALTER TABLE service_intakes MODIFY COLUMN status ENUM('received', 'in_progress', 'ready', 'converted', 'delivered', 'cancelled') NOT NULL DEFAULT 'received'");
    }
};
