<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FundTransfer extends Model
{
    protected $fillable = [
        'from_payment_method_id', 'to_payment_method_id', 'amount', 'transfer_date',
        'description', 'journal_entry_id', 'created_by',
    ];

    protected $casts = [
        'amount' => 'float',
        'transfer_date' => 'date',
    ];

    public function fromPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'from_payment_method_id');
    }

    public function toPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'to_payment_method_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
