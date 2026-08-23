<?php

namespace App\Services\Scraping;

use App\Services\Scraping\Contracts\SiteScraper;
use InvalidArgumentException;

class ScraperFactory
{
    /** @var array<string, class-string<SiteScraper>> */
    private const MAP = [
        'startech' => StarTechScraper::class,
        // 'ryans' and 'techland' are both behind Cloudflare's bot-challenge and need a headless
        // browser or a bypass proxy service before a scraper can be added here — deliberately not
        // wired up yet (see the plan doc for the reality-check that confirmed this).
    ];

    public static function make(string $slug): SiteScraper
    {
        if (!isset(self::MAP[$slug])) {
            throw new InvalidArgumentException("Unknown scrape source site: {$slug}");
        }

        return app(self::MAP[$slug]);
    }

    /** @return string[] */
    public static function slugs(): array
    {
        return array_keys(self::MAP);
    }

    /** Resolve a scraper by matching a URL's host against each registered scraper's hosts(). */
    public static function forUrl(string $url): ?SiteScraper
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            return null;
        }
        $host = preg_replace('/^www\./', '', strtolower($host));

        foreach (self::MAP as $slug => $class) {
            $scraperHosts = array_map(
                fn ($h) => preg_replace('/^www\./', '', strtolower($h)),
                $class::hosts()
            );
            if (in_array($host, $scraperHosts, true)) {
                return self::make($slug);
            }
        }

        return null;
    }

    /** @return array<int, array{slug: string, label: string, hosts: string[]}> */
    public static function descriptors(): array
    {
        return array_map(
            fn ($class) => [
                'slug' => $class::slug(),
                'label' => $class::label(),
                'hosts' => $class::hosts(),
            ],
            self::MAP
        );
    }
}
