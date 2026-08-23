<?php

namespace App\Services\Scraping\Support;

use Illuminate\Support\Facades\Http;
use Symfony\Component\DomCrawler\Crawler;

/**
 * Shared outbound-HTTP wrapper for every site scraper — UA, timeout, proxying, and the
 * politeness delay all live here once instead of being duplicated per scraper.
 *
 * The production server's own outbound IP gets Cloudflare-challenged by every target site
 * (confirmed directly: a non-datacenter IP passes cleanly, the server's IP does not — this is an
 * IP-reputation check, not something fixable by changing headers). When SCRAPER_API_KEY is set,
 * requests are routed through ScraperAPI (scraperapi.com), which handles proxying + the
 * Cloudflare challenge on its end and returns plain HTML. Without a key configured, requests go
 * direct — useful for local development from a non-flagged IP.
 */
class HtmlFetcher
{
    private const PROXY_ENDPOINT = 'https://api.scraperapi.com/';

    /**
     * Fetch a page and return it parsed as a DOM crawler.
     *
     * @throws RateLimitedException on 403/429 (never retry these — see class docblock)
     * @throws \Illuminate\Http\Client\RequestException on other HTTP failures
     */
    public function fetch(string $url): Crawler
    {
        $apiKey = config('scraping.proxy_api_key');

        $request = Http::timeout((int) config('scraping.timeout', 20))
            ->retry(2, 2000, function ($exception) {
                // Never retry a rate-limit or a block — retrying is exactly how a soft
                // rate-limit escalates into a permanent IP ban. Only retry transient
                // connection/5xx failures.
                if ($exception instanceof \Illuminate\Http\Client\RequestException) {
                    $status = $exception->response->status();
                    return $status !== 403 && $status !== 429;
                }
                return true;
            });

        if ($apiKey) {
            $response = $request->get(self::PROXY_ENDPOINT, [
                'api_key' => $apiKey,
                'url' => $url,
                'render' => 'true', // needed to clear the Cloudflare JS challenge
            ]);
        } else {
            $response = $request
                ->withHeaders([
                    'User-Agent' => config('scraping.user_agent'),
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ])
                ->get($url);
        }

        if ($response->status() === 403 || $response->status() === 429) {
            throw new RateLimitedException($url, $response->status());
        }

        $response->throw();

        return new Crawler($response->body(), $url);
    }

    /**
     * Sleep the configured politeness delay with jitter. A perfectly periodic interval between
     * requests is an easy bot fingerprint, so a random jitter is layered on top of the base delay
     * rather than sleeping the exact same duration every time. Skipped entirely when proxying
     * through a bypass service — the delay is this app's own politeness toward the target site,
     * which is the proxy provider's concern once requests are routed through them.
     */
    public function politenessDelay(): void
    {
        if (config('scraping.proxy_api_key')) {
            return;
        }

        $base = (int) config('scraping.request_delay_ms', 1500);
        $jitterPct = (int) config('scraping.delay_jitter_pct', 30);
        $jitter = (int) ($base * ($jitterPct / 100) * (mt_rand(-100, 100) / 100));
        $delayMs = max(0, $base + $jitter);
        usleep($delayMs * 1000);
    }
}
