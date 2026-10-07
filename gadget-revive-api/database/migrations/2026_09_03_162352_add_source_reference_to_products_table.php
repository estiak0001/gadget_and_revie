<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Carries a scraped-and-promoted product's original source (site/URL/source-site product id)
 * onto the real Product row itself — previously this only lived on the scraped_products staging
 * row, so it was lost the moment a product was promoted (or if the staging row was later
 * deleted). Left null for every other creation path (manual, Excel bulk-upload) since neither
 * has a source URL concept.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('source_site', 32)->nullable()->after('bulk_upload_batch');
            $table->string('source_url')->nullable()->after('source_site');
            $table->string('source_product_id')->nullable()->after('source_url');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['source_site', 'source_url', 'source_product_id']);
        });
    }
};
