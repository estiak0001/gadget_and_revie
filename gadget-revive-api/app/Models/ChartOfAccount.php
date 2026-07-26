<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChartOfAccount extends Model
{
    protected $fillable = [
        'code', 'name', 'type', 'normal_balance', 'description', 'is_active', 'is_system',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_system' => 'boolean',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class, 'account_id');
    }

    /** Signed balance as of an optional date, in the account's normal-balance direction (positive = normal). */
    public function balanceAsOf(?string $date = null): float
    {
        $query = $this->lines()
            ->when($date, fn ($q) => $q->whereHas('journalEntry', fn ($j) => $j->where('entry_date', '<=', $date)));

        $debit = (clone $query)->sum('debit');
        $credit = (clone $query)->sum('credit');

        return $this->normal_balance === 'debit' ? $debit - $credit : $credit - $debit;
    }

    /** Signed activity (net movement) strictly between two dates, in the account's normal-balance direction. */
    public function activityBetween(string $from, string $to): float
    {
        $lines = $this->lines()->whereHas('journalEntry', fn ($q) => $q->whereBetween('entry_date', [$from, $to]));

        $debit = (clone $lines)->sum('debit');
        $credit = (clone $lines)->sum('credit');

        return $this->normal_balance === 'debit' ? $debit - $credit : $credit - $debit;
    }
}
