<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scraped_products', function (Blueprint $table) {
            $table->id();

            // Provenance — nullOnDelete (not cascade): deleting a scrape job must never destroy
            // drafts already activated into real products.
            $table->foreignId('scrape_job_id')->nullable()->constrained('scrape_jobs')->nullOnDelete();
            $table->string('source_site', 32);
            $table->string('source_url', 500);
            // sha256 of the normalized URL (lowercased host, query string + trailing slash
            // stripped) — the dedupe key that makes re-crawling the same category idempotent.
            $table->char('source_url_hash', 64)->unique();

            // Source snapshot — scraper-written, refreshed by the stock re-check, never
            // admin-edited.
            $table->decimal('source_price', 10, 2)->nullable();
            $table->decimal('source_regular_price', 10, 2)->nullable();
            // Nullable, not just boolean: null = not yet parsed/unknown, distinct from false.
            $table->boolean('source_in_stock')->nullable();
            $table->string('source_stock_text', 100)->nullable();
            // Anything parsed that didn't map to a column — lets a field be added later without
            // needing to re-crawl.
            $table->json('raw_payload')->nullable();

            // Editable draft — seeded from the source snapshot, then owned by the admin during
            // review (same "editable copy" idea as Service Intakes' convert-to-order flow).
            // Deliberately never named `brand` — products.brand already shares its name with the
            // brand() Eloquent relation and that collision broke whenLoaded() earlier this
            // session; *_text here also marks these as raw unmapped strings, distinct from
            // mapped_brand_id below.
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->string('brand_text')->nullable();
            $table->string('model_text')->nullable();
            $table->longText('description')->nullable();
            $table->text('short_description')->nullable();
            $table->decimal('price', 10, 2)->nullable();
            $table->decimal('discount_price', 10, 2)->nullable();
            $table->json('specifications')->nullable();
            // Remote absolute URLs — not downloaded until activation.
            $table->json('image_urls')->nullable();
            $table->foreignId('mapped_category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->foreignId('mapped_brand_id')->nullable()->constrained('product_brands')->nullOnDelete();
            // Staged in the exact {attribute_id, value_ids[]|text_value} shape
            // syncProductAttributeValues() already expects.
            $table->json('attribute_values')->nullable();
            $table->string('unit', 50)->default('piece');
            $table->unsignedSmallInteger('warranty_value')->nullable();
            $table->string('warranty_unit')->nullable();

            // Workflow
            $table->enum('status', ['draft', 'activated', 'rejected'])->default('draft');
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reject_reason', 255)->nullable();

            // Stock-sync control
            $table->boolean('sync_enabled')->default(true);
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->unsignedTinyInteger('check_failures')->default(0);
            $table->unsignedInteger('restock_qty')->nullable();
            // Snapshot taken at the moment stock is zeroed by a sync, so a later restock restores
            // the real prior quantity instead of guessing.
            $table->unsignedInteger('stock_qty_before_sync')->nullable();
            $table->boolean('deactivate_when_out_of_stock')->default(false);
            // The guard that stops the sync job un-hiding a product a human deliberately hid —
            // restoring is_active on restock only happens if this is true, and it's cleared
            // immediately after.
            $table->boolean('deactivated_by_sync')->default(false);

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'sync_enabled', 'last_checked_at']);
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scraped_products');
    }
};
