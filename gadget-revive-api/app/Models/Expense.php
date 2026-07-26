<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'expense_category_id',
        'order_item_id',
        'title',
        'amount',
        'expense_date',
        'description',
        'reference',
        'created_by',
        'is_reversed',
        'reversed_at',
        'reversed_by',
    ];

    protected $casts = [
        'amount'      => 'decimal:2',
        'expense_date' => 'date',
        'is_reversed' => 'boolean',
        'reversed_at' => 'datetime',
    ];

    protected $appends = ['is_ledger_synced'];

    public function category()
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reverser()
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }

    /** The order line item this cost was incurred to fulfill (outsourced repair, parts bought, etc.), if any. */
    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    /** Has this expense ever had a journal entry posted for it (regardless of whether it was later reversed)? */
    public function isLedgerSynced(): bool
    {
        return JournalEntry::where('reference_type', 'Expense')->where('reference_id', $this->id)->exists();
    }

    public function getIsLedgerSyncedAttribute(): bool
    {
        return $this->isLedgerSynced();
    }

    /**
     * Does this expense currently have a live (non-reversal, not-yet-reversed) journal entry?
     * Unlike isLedgerSynced(), this returns false once the entry has been reversed, so
     * postJournalEntry() can safely repost after a reverse (e.g. on amount/date edits).
     */
    public function hasActiveLedgerEntry(): bool
    {
        $originalIds = JournalEntry::where('reference_type', 'Expense')
            ->where('reference_id', $this->id)
            ->where('is_reversal', false)
            ->pluck('id');

        if ($originalIds->isEmpty()) {
            return false;
        }

        $reversedIds = JournalEntry::whereIn('reversed_entry_id', $originalIds)->pluck('reversed_entry_id');

        return $originalIds->diff($reversedIds)->isNotEmpty();
    }

    /**
     * Post Dr Expense / Cr Cash for this expense. No-ops if there's already a live entry.
     * Expenses tied to an order item (a cost incurred to fulfill a sale — an outsourced
     * repair, a part bought for it) post to Cost of Goods Sold (5000) instead of the
     * general Operating Expenses (5100) bucket, so income-statement margin reporting can
     * separate "cost of what we sold" from ordinary overhead.
     */
    public function postJournalEntry(?User $user = null): ?JournalEntry
    {
        if ($this->hasActiveLedgerEntry()) {
            return null;
        }

        $expenseAccountCode = $this->order_item_id ? '5000' : '5100';

        return JournalEntry::post($this->expense_date->toDateString(), 'Expense', $this->id, $this->title, [
            ['account_code' => $expenseAccountCode, 'debit' => $this->amount],
            ['account_code' => '1000', 'credit' => $this->amount],
        ], $user);
    }
}
