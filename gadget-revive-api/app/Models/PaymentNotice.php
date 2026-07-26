<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentNotice extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'vendor_profile_id',
        'method',
        'instructions_shown',
        'transaction_reference',
        'payment_proof_image',
        'amount',
        'status',
        'marked_by',
        'marked_at',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'marked_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    public function markedByUser()
    {
        return $this->belongsTo(User::class, 'marked_by');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeConfirmed($query)
    {
        return $query->where('status', 'confirmed');
    }

    public function confirm(User $user, ?string $notes = null): void
    {
        $this->update([
            'status' => 'confirmed',
            'marked_by' => $user->id,
            'marked_at' => now(),
            'notes' => $notes,
        ]);
    }

    public function reject(User $user, ?string $notes = null): void
    {
        $this->update([
            'status' => 'rejected',
            'marked_by' => $user->id,
            'marked_at' => now(),
            'notes' => $notes,
        ]);
    }
}
