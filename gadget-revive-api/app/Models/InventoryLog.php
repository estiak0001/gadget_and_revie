<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'vendor_profile_id',
        'type',
        'quantity_before',
        'quantity_change',
        'quantity_after',
        'order_id',
        'purchase_order_id',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'quantity_before' => 'integer',
        'quantity_change' => 'integer',
        'quantity_after' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByProduct($query, $productId)
    {
        return $query->where('product_id', $productId);
    }

    public function scopeByVendor($query, $vendorProfileId)
    {
        return $query->where('vendor_profile_id', $vendorProfileId);
    }

    // Static helper to log inventory change
    public static function logChange(
        Product $product,
        string $type,
        int $quantityChange,
        ?Order $order = null,
        ?string $reason = null,
        ?User $user = null
    ): self {
        $quantityBefore = $product->stock_qty;
        $quantityAfter = $type === 'deduction' || $type === 'sale' 
            ? $quantityBefore - abs($quantityChange)
            : $quantityBefore + abs($quantityChange);

        return self::create([
            'product_id' => $product->id,
            'vendor_profile_id' => $product->vendor_profile_id ?? $order?->vendor_profile_id,
            'type' => $type,
            'quantity_before' => $quantityBefore,
            'quantity_change' => $quantityChange,
            'quantity_after' => $quantityAfter,
            'order_id' => $order?->id,
            'reason' => $reason,
            'created_by' => $user?->id,
        ]);
    }
}
