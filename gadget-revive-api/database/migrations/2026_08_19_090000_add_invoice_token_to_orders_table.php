<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Short opaque token backing the {invoice_url} link sent in delivery/payment-due
            // SMS — e.g. https://api.gadgetandrevive.com/api/i/aB3kZ9Qw — the token itself is
            // the access control (unguessable, no login needed), generated lazily the first
            // time a message needs it and reused after that (see Order::getOrCreateInvoiceToken()).
            $table->string('invoice_token', 12)->nullable()->unique()->after('order_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('invoice_token');
        });
    }
};
