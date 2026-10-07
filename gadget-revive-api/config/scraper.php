<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Scraper CLI settings
    |--------------------------------------------------------------------------
    |
    | Backs the admin's "Run Scraper" trigger on /scraped-products (see ScrapeRunController and
    | scraper/run_scrape.py). The script only ever regenerates and runs startech_scrap.ipynb's
    | own code -- it never duplicates the scraping logic -- so pointing this at a different
    | notebook path or python binary is the only thing that ever needs changing here.
    |
    | Note: startech.com.bd Cloudflare-blocks this app's production server IP (confirmed
    | exhaustively elsewhere in this codebase -- see ScrapedProductController's docblock), so this
    | trigger only succeeds where the API process itself has an unblocked IP, i.e. run locally.
    */

    'python_bin' => env('SCRAPER_PYTHON_BIN', 'python3'),

    'notebook_path' => env('SCRAPER_NOTEBOOK_PATH', base_path('../startech_scrap.ipynb')),

    'timeout' => (int) env('SCRAPER_TIMEOUT', 7200),

];
