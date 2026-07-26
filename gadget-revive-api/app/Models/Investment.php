<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Investment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['investor_id', 'type', 'amount', 'investment_date', 'description', 'created_by'];

    protected $casts = [
        'amount' => 'decimal:2',
        'investment_date' => 'date',
    ];

    public function investor(): BelongsTo
    {
        return $this->belongsTo(Investor::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Post this investment's journal entry — a contribution brings cash in and increases what the
     * business owes the investor; a return pays cash out and reduces it. Always Cash vs Investor
     * Capital, so this is a simple two-line entry either direction.
     */
    public function postToLedger(?User $user = null): JournalEntry
    {
        $lines = $this->type === 'contribution'
            ? [
                ['account_code' => '1000', 'debit' => $this->amount],
                ['account_code' => '2030', 'credit' => $this->amount],
            ]
            : [
                ['account_code' => '2030', 'debit' => $this->amount],
                ['account_code' => '1000', 'credit' => $this->amount],
            ];

        $verb = $this->type === 'contribution' ? 'Investment from' : 'Return to investor';
        $description = "{$verb} {$this->investor->name}" . ($this->description ? ": {$this->description}" : '');

        return JournalEntry::post(
            $this->investment_date->toDateString(),
            'Investment',
            $this->id,
            $description,
            $lines,
            $user
        );
    }
}
