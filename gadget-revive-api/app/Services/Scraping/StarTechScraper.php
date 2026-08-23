<?php

namespace App\Services\Scraping;

use App\Services\Scraping\Contracts\SiteScraper;
use App\Services\Scraping\Support\HtmlFetcher;
use App\Services\Scraping\Support\ScrapedAvailability;
use App\Services\Scraping\Support\ScrapedListingPage;
use App\Services\Scraping\Support\ScrapedProductData;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Selectors below were confirmed against real, live startech.com.bd HTML (not guessed) — the
 * site uses schema.org product microdata (meta price/availability/brand tags), which is unusually
 * scraper-friendly. If Star Tech redesigns their markup, this is the one class that needs
 * updating; nothing else in the pipeline depends on their specific HTML.
 */
class StarTechScraper implements SiteScraper
{
    public function __construct(private readonly HtmlFetcher $fetcher)
    {
    }

    public static function slug(): string
    {
        return 'startech';
    }

    public static function label(): string
    {
        return 'Star Tech';
    }

    public static function hosts(): array
    {
        return ['startech.com.bd', 'www.startech.com.bd'];
    }

    public function fetchListing(string $url): ScrapedListingPage
    {
        $crawler = $this->fetcher->fetch($url);

        // Matches both of Star Tech's listing layouts (grid card <h4 class="product-name"> and
        // compact table <td class="product-name">) since the selector is class-based, not
        // tag-based.
        $productUrls = $crawler->filter('.product-name a')
            ->each(fn (Crawler $node) => $node->attr('href'));
        $productUrls = array_values(array_unique(array_filter($productUrls)));

        // Rather than parsing the pagination widget's markup (fragile — its exact structure
        // varies between the grid and table listing layouts), just construct the next page
        // number directly. The crawl job's own termination condition — stop once a fetched page
        // yields zero product URLs — is what actually decides when to stop, so an "over-guessed"
        // next-page URL costs nothing beyond one extra harmless fetch.
        $nextPageUrl = $this->buildNextPageUrl($url);

        return new ScrapedListingPage($productUrls, $nextPageUrl);
    }

    public function fetchProduct(string $url): ScrapedProductData
    {
        $crawler = $this->fetcher->fetch($url);

        $name = $this->firstText($crawler, 'h1.product-name');
        $price = $this->metaFloat($crawler, 'product:price:amount');
        $inStock = $this->parseInStock($crawler);
        $stockText = $this->metaContent($crawler, 'product:availability')
            ?? $this->firstText($crawler, '.product-status');
        $brandText = $this->metaContent($crawler, 'product:brand');

        $descriptionHtml = $this->firstHtml($crawler, '.full-description');
        $shortDescription = $descriptionHtml
            ? \Illuminate\Support\Str::limit(trim(strip_tags($descriptionHtml)), 200)
            : null;

        $images = [];
        $ogImage = $this->metaContent($crawler, 'og:image');
        if ($ogImage) {
            $images[] = $ogImage;
        }
        $crawler->filter('a.thumbnail')->each(function (Crawler $node) use (&$images) {
            $href = $node->attr('href');
            if ($href) {
                $images[] = $href;
            }
        });
        $images = array_values(array_unique($images));

        $specifications = [];
        $crawler->filter('table.data-table tbody tr')->each(function (Crawler $row) use (&$specifications) {
            $nameCell = $row->filter('td.name');
            $valueCell = $row->filter('td.value');
            if ($nameCell->count() > 0 && $valueCell->count() > 0) {
                $key = trim($nameCell->text(''));
                $value = trim($valueCell->text(''));
                if ($key !== '' && $value !== '') {
                    $specifications[$key] = $value;
                }
            }
        });

        return new ScrapedProductData(
            name: $name ?? '',
            price: $price,
            regularPrice: null, // Star Tech doesn't expose a reliable base "was" price site-wide
            inStock: $inStock,
            stockText: $stockText,
            brandText: $brandText,
            description: $descriptionHtml,
            shortDescription: $shortDescription,
            imageUrls: $images,
            specifications: $specifications,
        );
    }

    public function fetchAvailability(string $url): ScrapedAvailability
    {
        $crawler = $this->fetcher->fetch($url);

        return new ScrapedAvailability(
            inStock: $this->parseInStock($crawler),
            statusText: $this->metaContent($crawler, 'product:availability'),
            price: $this->metaFloat($crawler, 'product:price:amount'),
        );
    }

    private function parseInStock(Crawler $crawler): ?bool
    {
        $availability = $this->metaContent($crawler, 'product:availability');
        if ($availability !== null) {
            return str_contains(strtolower($availability), 'in stock');
        }

        $statusText = $this->firstText($crawler, '.product-status');
        if ($statusText !== null) {
            return str_contains(strtolower($statusText), 'in stock');
        }

        return null;
    }

    private function buildNextPageUrl(string $url): string
    {
        $parts = parse_url($url);
        parse_str($parts['query'] ?? '', $query);
        $currentPage = isset($query['page']) ? (int) $query['page'] : 1;
        $query['page'] = $currentPage + 1;

        $rebuilt = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '')
            . ($parts['path'] ?? '') . '?' . http_build_query($query);

        return $rebuilt;
    }

    private function metaContent(Crawler $crawler, string $property): ?string
    {
        $node = $crawler->filter("meta[property=\"{$property}\"]");
        return $node->count() > 0 ? $node->attr('content') : null;
    }

    private function metaFloat(Crawler $crawler, string $property): ?float
    {
        $content = $this->metaContent($crawler, $property);
        return $content !== null && is_numeric($content) ? (float) $content : null;
    }

    private function firstText(Crawler $crawler, string $selector): ?string
    {
        $node = $crawler->filter($selector);
        return $node->count() > 0 ? trim($node->first()->text('')) : null;
    }

    private function firstHtml(Crawler $crawler, string $selector): ?string
    {
        $node = $crawler->filter($selector);
        return $node->count() > 0 ? $node->first()->html('') : null;
    }
}
