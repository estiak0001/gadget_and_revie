<?php

namespace App\Services\Scraping\Support;

final class ScrapedProductData
{
    /**
     * @param string[] $imageUrls
     * @param array<string,string> $specifications flat key => value
     * @param array<string,mixed> $rawPayload anything parsed that didn't map to a column
     */
    public function __construct(
        public readonly string $name,
        public readonly ?float $price,
        public readonly ?float $regularPrice,
        public readonly ?bool $inStock,
        public readonly ?string $stockText,
        public readonly ?string $brandText,
        public readonly ?string $description,
        public readonly ?string $shortDescription,
        public readonly array $imageUrls,
        public readonly array $specifications,
        public readonly array $rawPayload = [],
    ) {
    }
}
