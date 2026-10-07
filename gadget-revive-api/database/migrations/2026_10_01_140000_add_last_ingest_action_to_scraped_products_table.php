<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Persists what ingest() actually did the last time this row was touched -- created, updated
 * (re-scrape of a still-pending row), reactivated (re-scrape of a rejected row), or
 * synced_to_product (re-scrape of an already-promoted row, pushed onto the live Product). This
 * was previously only ever visible in that single HTTP response's `status` field, with nothing
 * left to look at afterward -- the admin's /scraped-products list now badges it per row instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scraped_products', function (Blueprint $table) {
            $table->string('last_ingest_action', 20)->nullable()->after('status');
            $table->timestamp('last_ingested_at')->nullable()->after('last_ingest_action');
        });
    }

    public function down(): void
    {
        Schema::table('scraped_products', function (Blueprint $table) {
            $table->dropColumn(['last_ingest_action', 'last_ingested_at']);
        });
    }
};
