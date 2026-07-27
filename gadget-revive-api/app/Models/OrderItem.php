<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'item_type',
        'product_id',
        'service_id',
        'item_name',
        'item_sku',
        'quantity',
        'unit_price',
        'total_price',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function service()
    {
        return $this->belongsTo(Service::class);
    }

    public function getItem()
    {
        return $this->item_type === 'product' ? $this->product : $this->service;
    }

    /**
     * Costs incurred to fulfill this line item (outsourced repair, parts bought, etc.),
     * each a real Expense record. Reversed costs are soft-deleted, so Eloquent's default
     * scope already excludes them here — a reversed cost stops counting against margin.
     */
    public function costs()
    {
        return $this->hasMany(Expense::class, 'order_item_id');
    }

    /**
     * Everything spent fulfilling this line item: the product's own acquisition cost (weighted
     * average cost from Purchase Order receipts, times quantity sold) plus any manually-recorded
     * costs (outsourced repair, parts bought for a service, etc.). Zero for a product that's
     * never been received via a costed Purchase Order (average_cost unset) and for service/custom
     * items with no manual costs — matches how those already showed 0 before this existed.
     */
    public function getTotalCostAttribute(): float
    {
        $productCost = $this->item_type === 'product' && $this->product
            ? $this->quantity * (float) ($this->product->average_cost ?? 0)
            : 0;

        return round($productCost + (float) $this->costs()->sum('amount'), 2);
    }

    /** Revenue for this line item minus everything spent fulfilling it. */
    public function getMarginAttribute(): float
    {
        return (float) $this->total_price - $this->total_cost;
    }
}
