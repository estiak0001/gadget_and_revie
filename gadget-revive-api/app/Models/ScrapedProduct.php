<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A product submitted by an external scraping script, waiting for an admin to review, map its
 * category, and either Promote it into a real Product or Reject it. See the migration's docblock
 * and ScrapedProductController for the full workflow.
 */
class ScrapedProduct extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'batch',
        'source_site',
        'source_url',
        'source_product_id',
        'category_raw',
        'category_id',
        'brand_raw',
        'brand_id',
        'sku',
        'name',
        'name_bn',
        'price',
        'discount_price',
        'stock_qty',
        'stock_status_raw',
        'current_cost',
        'unit',
        'short_description',
        'description',
        'specifications',
        'image',
        'gallery',
        'model',
        'warranty_value',
        'warranty_unit',
        'status',
        'last_ingest_action',
        'last_ingested_at',
        'promoted_product_id',
        'reject_reason',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_price' => 'decimal:2',
        'current_cost' => 'decimal:2',
        'stock_qty' => 'integer',
        'warranty_value' => 'integer',
        'gallery' => 'array',
        'specifications' => 'array',
        'reviewed_at' => 'datetime',
        'last_ingested_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(ProductBrand::class, 'brand_id');
    }

    public function promotedProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'promoted_product_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** A row can only be promoted once it's pending, has a manually-mapped category, and a real price. */
    public function canPromote(): bool
    {
        return $this->status === 'pending' && $this->category_id !== null && (float) $this->price > 0;
    }

    public function canReject(): bool
    {
        return $this->status === 'pending';
    }
}
