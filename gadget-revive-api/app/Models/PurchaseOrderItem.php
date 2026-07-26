<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    use HasFactory;

    protected $fillable = ['purchase_order_id', 'product_id', 'quantity', 'received_qty', 'unit_cost', 'total_cost'];

    protected $casts = ['unit_cost' => 'decimal:2', 'total_cost' => 'decimal:2'];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function isFullyReceived(): bool
    {
        return $this->received_qty >= $this->quantity;
    }

    public function remainingQty(): int
    {
        return max(0, $this->quantity - $this->received_qty);
    }
}
