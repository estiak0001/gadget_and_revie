<?php

namespace App\Services\Scraping\Support;

use Exception;

/**
 * Thrown when a source site responds 403 (blocked) or 429 (rate-limited). Callers (the crawl job)
 * should treat this as a signal to abort the whole run rather than retry — retrying a rate-limit
 * is how it escalates into a permanent IP ban.
 */
class RateLimitedException extends Exception
{
    public function __construct(
        public readonly string $url,
        public readonly int $statusCode,
    ) {
        parent::__construct("Blocked or rate-limited (HTTP {$statusCode}) fetching {$url}");
    }
}
