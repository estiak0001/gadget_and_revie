<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per web-triggered run of the Python scraper. See ScrapeRunController and
 * scraper/run_scrape.py for the full flow: created with status=running right before the script
 * is launched detached, then flipped to completed/failed by the script's own completion
 * callback (or, defensively, by a stale-PID check in ScrapeRunController::show()).
 */
class ScrapeRun extends Model
{
    protected $fillable = [
        'category_url',
        'category_name',
        'brand_filter',
        'product_limit',
        'template_category',
        'batch',
        'status',
        'pid',
        'created_count',
        'updated_count',
        'synced_count',
        'skipped_count',
        'failed_count',
        'error_message',
        'triggered_by',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'product_limit' => 'integer',
        'pid' => 'integer',
        'created_count' => 'integer',
        'updated_count' => 'integer',
        'synced_count' => 'integer',
        'skipped_count' => 'integer',
        'failed_count' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }
}
