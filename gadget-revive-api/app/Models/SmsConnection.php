<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsConnection extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'provider_name', 'api_url', 'balance_url', 'report_url', 'method', 'api_key',
        'sender_id', 'phone_format', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
