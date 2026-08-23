<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ScrapedProduct extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'scrape_job_id',
        'source_site',
        'source_url',
        'source_url_hash',
        'source_price',
        'source_regular_price',
        'source_in_stock',
        'source_stock_text',
        'raw_payload',
        'name',
        'name_bn',
        'brand_text',
        'model_text',
        'description',
        'short_description',
        'price',
        'discount_price',
        'specifications',
        'image_urls',
        'mapped_category_id',
        'mapped_brand_id',
        'attribute_values',
        'unit',
        'warranty_value',
        'warranty_unit',
        'status',
        'product_id',
        'activated_at',
        'rejected_at',
        'activated_by',
        'reject_reason',
        'sync_enabled',
        'last_checked_at',
        'last_synced_at',
        'check_failures',
        'restock_qty',
        'stock_qty_before_sync',
        'deactivate_when_out_of_stock',
        'deactivated_by_sync',
    ];

    protected $casts = [
        'source_price' => 'decimal:2',
        'source_regular_price' => 'decimal:2',
        'source_in_stock' => 'boolean',
        'raw_payload' => 'array',
        'price' => 'decimal:2',
        'discount_price' => 'decimal:2',
        'specifications' => 'array',
        'image_urls' => 'array',
        'attribute_values' => 'array',
        'warranty_value' => 'integer',
        'activated_at' => 'datetime',
        'rejected_at' => 'datetime',
        'sync_enabled' => 'boolean',
        'last_checked_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'check_failures' => 'integer',
        'restock_qty' => 'integer',
        'stock_qty_before_sync' => 'integer',
        'deactivate_when_out_of_stock' => 'boolean',
        'deactivated_by_sync' => 'boolean',
    ];

    public function scrapeJob()
    {
        return $this->belongsTo(ScrapeJob::class);
    }

    public function mappedCategory()
    {
        return $this->belongsTo(ProductCategory::class, 'mapped_category_id');
    }

    public function mappedBrand()
    {
        return $this->belongsTo(ProductBrand::class, 'mapped_brand_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function activator()
    {
        return $this->belongsTo(User::class, 'activated_by');
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function canActivate(): bool
    {
        return $this->isDraft() && $this->mapped_category_id !== null && (float) $this->price > 0;
    }

    public function canReject(): bool
    {
        return $this->isDraft();
    }

    public function canDelete(): bool
    {
        return $this->isDraft();
    }

    public function isSyncable(): bool
    {
        return $this->status === 'activated'
            && $this->sync_enabled
            && $this->product_id !== null
            && $this->product()->exists();
    }
}
