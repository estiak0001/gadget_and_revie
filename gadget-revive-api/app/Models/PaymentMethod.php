<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentMethod extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'code', 'type', 'chart_of_account_id',
        'account_holder_name', 'account_number', 'bank_name', 'branch_name',
        'notes', 'is_active', 'is_system', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_system' => 'boolean',
    ];

    public function chartOfAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class);
    }

    /** Current balance of the ledger account this payment method is linked to. */
    public function getBalanceAttribute(): float
    {
        return $this->chartOfAccount?->balanceAsOf() ?? 0.0;
    }
}
