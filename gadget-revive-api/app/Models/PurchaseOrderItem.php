<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id', 'product_id', 'quantity', 'received_qty', 'returned_qty', 'unit_cost', 'total_cost',
        'warranty_value', 'warranty_unit',
    ];

    protected $casts = [
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'warranty_value' => 'integer',
        'returned_qty' => 'integer',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * `withTrashed()` is deliberate: a purchase order is a historical record and must keep
     * showing which product a line item was for even after that product is later deleted from
     * the live catalog — without it, the default belongsTo silently returns null for a
     * soft-deleted product, which crashed every code path that assumed $item->product always
     * exists (return-to-supplier, receipt correction, PDF rendering, etc.).
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function serials()
    {
        return $this->hasMany(ProductSerial::class);
    }

    public function isFullyReceived(): bool
    {
        return $this->received_qty >= $this->quantity;
    }

    public function remainingQty(): int
    {
        return max(0, $this->quantity - $this->received_qty);
    }

    /** How much of what's been received from this line is still eligible to send back to the supplier. */
    public function returnableQty(): int
    {
        return max(0, $this->received_qty - $this->returned_qty);
    }
}
