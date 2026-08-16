<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsCampaign extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'message', 'sms_connection_id', 'recipient_source',
        'recipient_count', 'sent_count', 'failed_count', 'status', 'created_by',
    ];

    public function connection(): BelongsTo
    {
        return $this->belongsTo(SmsConnection::class, 'sms_connection_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
