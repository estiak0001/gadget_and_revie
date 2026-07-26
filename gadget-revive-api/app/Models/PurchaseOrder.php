<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'po_number', 'supplier_id', 'status', 'subtotal', 'tax', 'shipping_cost', 'total', 'paid_amount',
        'expected_date', 'ordered_at', 'received_at', 'cancelled_at', 'notes', 'expense_id', 'created_by',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2', 'tax' => 'decimal:2', 'shipping_cost' => 'decimal:2', 'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'expected_date' => 'date', 'ordered_at' => 'datetime', 'received_at' => 'datetime', 'cancelled_at' => 'datetime',
    ];

    protected $appends = ['received_value', 'outstanding_payable', 'unposted_received_value', 'payment_status'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (PurchaseOrder $po) {
            if (empty($po->po_number)) {
                $po->po_number = 'PO-PENDING';
            }
        });

        static::created(function (PurchaseOrder $po) {
            if ($po->po_number === 'PO-PENDING') {
                $po->updateQuietly(['po_number' => 'PO-' . str_pad($po->id, 8, '0', STR_PAD_LEFT)]);
            }
        });
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function inventoryLogs(): HasMany
    {
        return $this->hasMany(InventoryLog::class);
    }

    public function isLocked(): bool
    {
        return in_array($this->status, ['received', 'cancelled']);
    }

    public function canReceive(): bool
    {
        return in_array($this->status, ['ordered', 'partially_received']);
    }

    public function canCancel(): bool
    {
        return in_array($this->status, ['draft', 'ordered', 'partially_received']);
    }

    /** Total value of goods actually received so far (what was journaled to Accounts Payable). */
    public function getReceivedValueAttribute(): float
    {
        return (float) $this->items->sum(fn (PurchaseOrderItem $item) => $item->received_qty * $item->unit_cost);
    }

    /** How much of the received value is still unpaid to the supplier. */
    public function getOutstandingPayableAttribute(): float
    {
        return round($this->received_value - (float) $this->paid_amount, 2);
    }

    public function canPay(): bool
    {
        return $this->outstanding_payable > 0;
    }

    /**
     * Supplier payment status derived from what's actually owed for goods
     * received so far (not the full PO total — you don't owe for stock that
     * hasn't arrived yet). One of: unpaid, partial, paid.
     */
    public function getPaymentStatusAttribute(): string
    {
        $received = $this->received_value;
        $paid = (float) $this->paid_amount;

        if ($received <= 0) {
            return $paid > 0 ? 'paid' : 'unpaid';
        }
        if ($paid <= 0) {
            return 'unpaid';
        }
        if ($paid >= $received) {
            return 'paid';
        }

        return 'partial';
    }

    /** Value already received but not yet reflected as an Inventory debit in the ledger. */
    public function getUnpostedReceivedValueAttribute(): float
    {
        $accountId = ChartOfAccount::where('code', '1020')->value('id');
        if (!$accountId) {
            return 0;
        }

        $posted = JournalEntryLine::where('account_id', $accountId)
            ->whereHas('journalEntry', fn ($q) => $q->where('reference_type', 'PurchaseOrder')->where('reference_id', $this->id)->where('is_reversal', false))
            ->sum('debit');

        return round($this->received_value - (float) $posted, 2);
    }

    /**
     * Post Dr Inventory / Cr Accounts Payable for a received value. Used both for the normal
     * receive() flow (one call per receipt) and as a later backfill for historical purchase
     * orders that had stock received before this accounting integration existed.
     */
    public function postReceiptJournalEntry(float $value, ?User $user = null): ?JournalEntry
    {
        if ($value <= 0) {
            return null;
        }

        return JournalEntry::post(now()->toDateString(), 'PurchaseOrder', $this->id, "Goods received for {$this->po_number}", [
            ['account_code' => '1020', 'debit' => $value],
            ['account_code' => '2000', 'credit' => $value],
        ], $user);
    }
}
