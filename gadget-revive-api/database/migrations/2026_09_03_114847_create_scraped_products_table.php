<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staging table for products submitted by an external scraping script (e.g. startech_scrap.ipynb,
 * run on the user's own machine — never this server, which Cloudflare challenge-blocks for all
 * three competitor sites). Nothing here ever reaches the storefront directly: an admin reviews
 * each row on /scraped-products, maps its category, edits anything needed, then "Promote"s it
 * into a real (still Inactive-by-default) Product — see ScrapedProductController::promote().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scraped_products', function (Blueprint $table) {
            $table->id();

            // Provenance — not a foreign key to anything, just where this came from.
            $table->string('batch', 64)->nullable();
            $table->string('source_site', 32); // e.g. 'startech' — plain string, not an enum: this list grows.
            $table->string('source_url')->nullable();
            $table->string('source_product_id')->nullable();

            // Raw scraped text alongside the resolved ids — category is intentionally left
            // unresolved (null) until an admin manually maps it during review; brand is resolved
            // at ingest time (match-or-create, same as the bulk-upload importer).
            $table->string('category_raw')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('brand_raw')->nullable();
            $table->foreignId('brand_id')->nullable()->constrained('product_brands')->nullOnDelete();

            // Catalog fields — mirrors the relevant subset of products' own columns.
            $table->string('sku')->nullable();
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->decimal('discount_price', 10, 2)->nullable();
            $table->integer('stock_qty')->nullable();
            $table->string('stock_status_raw')->nullable(); // e.g. "In Stock" / "Out of Stock" — exact qty is never available from a competitor page.
            $table->decimal('current_cost', 12, 2)->nullable();
            $table->string('unit')->nullable();
            $table->text('short_description')->nullable();
            $table->text('description')->nullable(); // already HTML-formatted at ingest time, same as the bulk importer.
            $table->json('specifications')->nullable();
            $table->string('image')->nullable();
            $table->json('gallery')->nullable();
            $table->string('model')->nullable();
            $table->unsignedSmallInteger('warranty_value')->nullable();
            $table->string('warranty_unit')->nullable();

            // Review workflow.
            $table->string('status', 20)->default('pending'); // pending | promoted | rejected
            $table->foreignId('promoted_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('reject_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('batch');
            $table->index('source_site');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scraped_products');
    }
};
