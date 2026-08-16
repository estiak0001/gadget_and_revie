<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SmsLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'phone', 'message', 'purpose', 'status', 'response', 'provider_request_id', 'cost',
        'related_id', 'sent_by', 'sms_connection_id', 'sms_campaign_id',
    ];

    protected $casts = [
        'cost' => 'decimal:4',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(SmsConnection::class, 'sms_connection_id');
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(SmsCampaign::class, 'sms_campaign_id');
    }
}
