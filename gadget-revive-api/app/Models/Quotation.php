<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A pre-sale offer/estimate — never tied to an Order (see CustomInvoice for the post-sale, order-
 * tied equivalent). `items` is a JSON snapshot, each row optionally carrying a `product_id` back
 * to the catalog item it was copied from for traceability only; nothing about a saved quotation
 * stays live-linked to the product or the customer record afterward.
 */
class Quotation extends Model
{
    protected $fillable = [
        'quotation_number', 'quotation_date', 'valid_until',
        'customer_id', 'customer_name', 'customer_phone', 'customer_email', 'customer_address',
        'items', 'subtotal', 'discount', 'shipping', 'tax', 'total',
        'notes', 'terms', 'status', 'created_by',
    ];

    protected $casts = [
        'quotation_date' => 'date',
        'valid_until' => 'date',
        'items' => 'array',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'shipping' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    protected $appends = ['is_expired'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (Quotation $quotation) {
            if (empty($quotation->quotation_number)) {
                // Matches Order's ORD-{date}-{random6} scheme (see Order::boot()) — same shape,
                // QUO prefix so the two document series are visually distinguishable at a glance.
                $quotation->quotation_number = 'QUO-' . now()->format('Ymd') . '-' . strtoupper(Str::random(6));
            }
            if (empty($quotation->quotation_date)) {
                $quotation->quotation_date = now()->toDateString();
            }
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getIsExpiredAttribute(): bool
    {
        return $this->valid_until !== null
            && $this->valid_until->isPast()
            && !in_array($this->status, ['accepted', 'rejected'], true);
    }
}
