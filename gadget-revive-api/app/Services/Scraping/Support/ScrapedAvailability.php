<?php

namespace App\Services\Scraping\Support;

final class ScrapedAvailability
{
    public function __construct(
        public readonly ?bool $inStock,
        public readonly ?string $statusText,
        public readonly ?float $price,
    ) {
    }
}
