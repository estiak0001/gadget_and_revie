<?php

namespace App\Services\Scraping\Contracts;

use App\Services\Scraping\Support\ScrapedAvailability;
use App\Services\Scraping\Support\ScrapedListingPage;
use App\Services\Scraping\Support\ScrapedProductData;

interface SiteScraper
{
    /** Short, stable identifier stored in scrape_jobs.source_site / scraped_products.source_site. */
    public static function slug(): string;

    /** Human-readable name shown in the admin's site picker. */
    public static function label(): string;

    /** Hostnames this scraper is responsible for (used to validate a pasted URL matches the chosen site). */
    public static function hosts(): array;

    /**
     * Parse one category/listing page: the product detail URLs on it, plus the next page's URL
     * (or null if this is the last page).
     */
    public function fetchListing(string $url): ScrapedListingPage;

    /**
     * Full parse of one product detail page — everything needed to create a draft
     * scraped_products row.
     */
    public function fetchProduct(string $url): ScrapedProductData;

    /**
     * A narrow, cheap re-check of just price + in-stock status. Deliberately separate from
     * fetchProduct() — the periodic stock re-check only needs this, and keeping it to a couple of
     * selectors means a site redesign that breaks the full product parse doesn't also break
     * stock-sync.
     */
    public function fetchAvailability(string $url): ScrapedAvailability;
}
