<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class JournalEntry extends Model
{
    protected $fillable = [
        'entry_number', 'entry_date', 'reference_type', 'reference_id', 'description',
        'created_by', 'reversed_entry_id', 'is_reversal',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'is_reversal' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function (JournalEntry $entry) {
            if (empty($entry->entry_number)) {
                $entry->entry_number = 'JE-PENDING';
            }
        });

        static::created(function (JournalEntry $entry) {
            if ($entry->entry_number === 'JE-PENDING') {
                $entry->updateQuietly(['entry_number' => 'JE-' . str_pad($entry->id, 8, '0', STR_PAD_LEFT)]);
            }
        });
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reversedEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'reversed_entry_id');
    }

    /**
     * Post a balanced journal entry.
     * $lines = [['account_code' => '1000', 'debit' => 500, 'description' => '...'], ['account_code' => '4000', 'credit' => 500]]
     *
     * @throws \InvalidArgumentException if debits != credits
     */
    public static function post(
        string $entryDate,
        ?string $referenceType,
        ?int $referenceId,
        string $description,
        array $lines,
        ?User $user = null
    ): self {
        $totalDebit = round((float) collect($lines)->sum('debit'), 2);
        $totalCredit = round((float) collect($lines)->sum('credit'), 2);

        if ($totalDebit !== $totalCredit) {
            throw new \InvalidArgumentException("Unbalanced journal entry: debit {$totalDebit} != credit {$totalCredit}");
        }

        return DB::transaction(function () use ($entryDate, $referenceType, $referenceId, $description, $lines, $user) {
            $entry = self::create([
                'entry_date' => $entryDate,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'description' => $description,
                'created_by' => $user?->id,
            ]);

            foreach ($lines as $line) {
                $account = ChartOfAccount::where('code', $line['account_code'])->firstOrFail();
                $entry->lines()->create([
                    'account_id' => $account->id,
                    'debit' => $line['debit'] ?? 0,
                    'credit' => $line['credit'] ?? 0,
                    'description' => $line['description'] ?? null,
                ]);
            }

            return $entry;
        });
    }

    /** Post a reversing entry (swap debit/credit on every line of $this), linked back via reversed_entry_id. */
    public function reverse(string $entryDate, string $description, ?User $user = null): self
    {
        $lines = $this->lines()->with('account')->get()->map(fn ($line) => [
            'account_code' => $line->account->code,
            'debit' => $line->credit,
            'credit' => $line->debit,
            'description' => $line->description,
        ])->toArray();

        $reversal = self::post($entryDate, $this->reference_type, $this->reference_id, $description, $lines, $user);
        $reversal->update(['is_reversal' => true, 'reversed_entry_id' => $this->id]);

        return $reversal;
    }

    /**
     * Find the latest non-reversal entry for a given reference and reverse it, unless it's
     * already been reversed. Returns null if there was nothing to reverse (no entry posted yet,
     * or it was already reversed) — safe to call from multiple cancel/refund code paths.
     */
    public static function reverseFor(string $referenceType, int $referenceId, string $description, ?User $user = null): ?self
    {
        $original = self::where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->where('is_reversal', false)
            ->latest()
            ->first();

        if (!$original) {
            return null;
        }

        $alreadyReversed = self::where('reversed_entry_id', $original->id)->exists();
        if ($alreadyReversed) {
            return null;
        }

        return $original->reverse(now()->toDateString(), $description, $user);
    }

    /**
     * Reverse every non-reversed entry for a given reference (not just the latest). Needed for
     * references that can accumulate multiple entries over time — e.g. an order with several
     * partial payments each posting their own entry — where cancelling/refunding must undo all
     * of them to net every affected account back to zero. Already-reversed entries are skipped;
     * safe to call more than once. Returns the reversal entries actually created.
     */
    public static function reverseAllFor(string $referenceType, int $referenceId, string $description, ?User $user = null): array
    {
        $originals = self::where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->where('is_reversal', false)
            ->get();

        $reversals = [];
        foreach ($originals as $original) {
            $alreadyReversed = self::where('reversed_entry_id', $original->id)->exists();
            if ($alreadyReversed) {
                continue;
            }
            $reversals[] = $original->reverse(now()->toDateString(), $description, $user);
        }

        return $reversals;
    }
}
