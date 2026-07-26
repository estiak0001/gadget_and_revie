<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CartItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'cart_id',
        'item_type',
        'product_id',
        'service_id',
        'quantity',
        'unit_price',
        'notes',
        'is_saved_for_later',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'is_saved_for_later' => 'boolean',
    ];

    public function cart()
    {
        return $this->belongsTo(Cart::class);
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

    public function getTotalPrice(): float
    {
        return $this->unit_price * $this->quantity;
    }

    public function scopeActive($query)
    {
        return $query->where('is_saved_for_later', false);
    }

    public function scopeSavedForLater($query)
    {
        return $query->where('is_saved_for_later', true);
    }
}
