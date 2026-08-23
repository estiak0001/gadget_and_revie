<?php

namespace App\Services\Scraping\Support;

final class ScrapedListingPage
{
    /** @param string[] $productUrls */
    public function __construct(
        public readonly array $productUrls,
        public readonly ?string $nextPageUrl,
    ) {
    }
}
