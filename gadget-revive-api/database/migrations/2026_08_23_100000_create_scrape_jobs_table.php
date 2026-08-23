<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scrape_jobs', function (Blueprint $table) {
            $table->id();

            // Not an enum — this list grows with every new competitor added, and this repo's
            // own 2026_08_02_123506_widen_type_enum_on_inventory_logs_table.php migration is
            // proof that widening an enum later costs a raw ALTER migration. Validated against
            // App\Services\Scraping\ScraperFactory::slugs() at the controller layer instead.
            $table->string('source_site', 32);
            $table->string('source_url', 500);

            $table->enum('status', ['queued', 'running', 'completed', 'failed', 'cancelled'])->default('queued');

            $table->unsignedSmallInteger('max_pages')->default(3);
            $table->unsignedSmallInteger('pages_crawled')->default(0);
            $table->unsignedInteger('items_found')->default(0);
            $table->unsignedInteger('items_created')->default(0);
            $table->unsignedInteger('items_skipped')->default(0);
            $table->unsignedInteger('items_failed')->default(0);

            // Per-product failures ({url, error} pairs) so one unparseable product page doesn't
            // sink visibility into an otherwise-successful 200-item crawl.
            $table->json('failed_urls')->nullable();
            $table->text('error_message')->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            // No softDeletes — this is disposable run metadata, not a record that needs
            // recovering; scraped_products.scrape_job_id is nullOnDelete precisely so deleting a
            // job never destroys drafts (or activated products) that came from it.

            $table->index('status');
            $table->index('source_site');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scrape_jobs');
    }
};
