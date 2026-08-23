<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ScrapeJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'source_site',
        'source_url',
        'status',
        'max_pages',
        'pages_crawled',
        'items_found',
        'items_created',
        'items_skipped',
        'items_failed',
        'failed_urls',
        'error_message',
        'started_at',
        'finished_at',
        'created_by',
    ];

    protected $casts = [
        'max_pages' => 'integer',
        'pages_crawled' => 'integer',
        'items_found' => 'integer',
        'items_created' => 'integer',
        'items_skipped' => 'integer',
        'items_failed' => 'integer',
        'failed_urls' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scrapedProducts()
    {
        return $this->hasMany(ScrapedProduct::class);
    }

    public function isRunning(): bool
    {
        return in_array($this->status, ['queued', 'running'], true);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['completed', 'failed', 'cancelled'], true);
    }

    public function canCancel(): bool
    {
        return $this->isRunning();
    }

    public function canDelete(): bool
    {
        // Refuse if any child was ever activated — deleting the job must never orphan the audit
        // trail of a draft that became a real, live product.
        return !$this->scrapedProducts()->where('status', 'activated')->exists();
    }
}
