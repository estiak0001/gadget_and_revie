<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A reusable, named snippet of Notes / Terms & Conditions text an admin can save once and reuse
 * across quotations. Picking one just copies its `content` into a quotation's own `notes`/`terms`
 * column at that moment — editing the template afterward never retroactively changes any
 * quotation that already used it (same "snapshot, not a live link" pattern as Quotation::items).
 */
class QuotationTemplate extends Model
{
    protected $fillable = [
        'type', 'title', 'content', 'is_default', 'created_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
