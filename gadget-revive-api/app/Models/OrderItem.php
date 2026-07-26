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

    public function getTotalCostAttribute(): float
    {
        return (float) $this->costs()->sum('amount');
    }

    /** Revenue for this line item minus everything spent fulfilling it. */
    public function getMarginAttribute(): float
    {
        return (float) $this->total_price - $this->total_cost;
    }
}
