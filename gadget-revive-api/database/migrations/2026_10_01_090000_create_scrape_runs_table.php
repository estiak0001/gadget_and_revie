<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks each web-triggered run of the Python scraper (see scraper/run_scrape.py and
 * ScrapeRunController) so the admin's "Run Scraper" card on /scraped-products can poll a run's
 * status and show a small history list. The scrape itself always executes as a detached local
 * process -- this table is just the status/outcome record, never the thing doing the scraping.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scrape_runs', function (Blueprint $table) {
            $table->id();

            $table->string('category_url', 2048);
            $table->string('category_name');
            $table->string('brand_filter')->nullable();
            $table->unsignedInteger('product_limit')->nullable();
            $table->string('template_category');
            $table->string('batch', 64);

            $table->string('status', 20)->default('running'); // running | completed | failed
            $table->unsignedInteger('pid')->nullable();
            $table->unsignedInteger('created_count')->nullable();
            $table->unsignedInteger('updated_count')->nullable();
            $table->unsignedInteger('synced_count')->nullable();
            $table->unsignedInteger('skipped_count')->nullable();
            $table->unsignedInteger('failed_count')->nullable();
            $table->text('error_message')->nullable();

            $table->foreignId('triggered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('batch');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scrape_runs');
    }
};
