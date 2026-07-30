<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A one-off invoice document issued to a customer that may intentionally diverge from the real
 * order (different amounts/items/customer details — e.g. for the customer's own reimbursement
 * paperwork). This never touches Order, stock, or the ledger; it's purely a persisted, auditable
 * snapshot of what was printed/downloaded, tied back to the real order it was issued against.
 */
class CustomInvoice extends Model
{
    protected $fillable = [
        'order_id', 'invoice_number', 'invoice_date',
        'customer_name', 'customer_phone', 'customer_email', 'customer_address',
        'items', 'subtotal', 'discount', 'shipping', 'tax', 'total', 'notes', 'created_by',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'items' => 'array',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'shipping' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
