<?php

// Crawl-behavior knobs only — per-site CSS selectors live as class constants inside each
// scraper class (app/Services/Scraping/*Scraper.php), not here. A DB-driven selector map would
// be over-engineering at 1-3 sites; these values are the things that genuinely need tuning
// per-environment without a code change.

return [

    // Delay between outbound requests during a crawl, in milliseconds. A perfectly periodic
    // interval is an easy bot fingerprint, so a random jitter is added on top of this base delay
    // (see delay_jitter_pct below) rather than sleeping exactly this long every time.
    'request_delay_ms' => (int) env('SCRAPING_REQUEST_DELAY_MS', 1500),

    // +/- percentage of request_delay_ms randomized on top of the base delay.
    'delay_jitter_pct' => (int) env('SCRAPING_DELAY_JITTER_PCT', 30),

    // HTTP client timeout (seconds) for both listing/product fetches and the lightweight
    // availability-only re-check.
    'timeout' => (int) env('SCRAPING_TIMEOUT', 20),

    // Hard server-side cap on how many listing pages a single crawl job will walk, regardless of
    // what the admin requests or how many "next page" links the site itself offers. Protects
    // against a mis-pasted "all products" URL turning into an unbounded crawl.
    'max_pages_cap' => (int) env('SCRAPING_MAX_PAGES_CAP', 20),

    // Hard server-side cap on total products imported by a single crawl job.
    'max_products_per_job' => (int) env('SCRAPING_MAX_PRODUCTS_PER_JOB', 500),

    // Sent as the User-Agent on every outbound scraping request. Identifies the bot with a
    // contact URL rather than pretending to be a real browser — an identifiable bot that behaves
    // (rate limits itself, respects robots.txt) is far less likely to get IP-banned than an
    // anonymous one that hammers a site.
    'user_agent' => env('SCRAPING_USER_AGENT', 'GadgetReviveBot/1.0 (+https://gadgetandrevive.com/bot)'),

    // How many activated+syncable scraped_products rows the hourly stock-recheck command
    // dispatches per run. At the default schedule (hourly) this spreads roughly this many
    // requests per hour across all tracked products and sites combined.
    'recheck_batch_size' => (int) env('SCRAPING_RECHECK_BATCH_SIZE', 60),

    // Fallback restock quantity used when a product's source flips back to "in stock" and neither
    // a prior stock_qty_before_sync snapshot nor a per-row restock_qty override is available. Kept
    // deliberately small (this is unowned reseller stock, not inventory actually held) — it lands
    // the product straight into the existing low-stock report (default low_stock_threshold is 5)
    // rather than overstating availability.
    'default_restock_qty' => (int) env('SCRAPING_DEFAULT_RESTOCK_QTY', 1),

    // Whether to fetch and honor robots.txt Disallow rules (and Crawl-delay, taking the max of it
    // and request_delay_ms) for the paths a crawl visits. Shown as a warning in the admin's Start
    // Scrape modal rather than a hard block — the admin makes the final call.
    'respect_robots' => (bool) env('SCRAPING_RESPECT_ROBOTS', true),

    // The production server's outbound IP gets Cloudflare-challenged by every one of the target
    // sites (confirmed directly — a residential/dev IP passes cleanly, the server's datacenter IP
    // does not), so requests are routed through a scraping-bypass proxy instead of hitting sites
    // directly. Set SCRAPER_API_KEY in .env to enable; when it's empty, HtmlFetcher falls back to
    // a direct request (useful for local dev from a non-flagged IP).
    'proxy_api_key' => env('SCRAPER_API_KEY'),

];
