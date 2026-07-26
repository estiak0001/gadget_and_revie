<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Review extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'order_id',
        'user_id',
        'vendor_profile_id',
        'rating',
        'review',
        'images',
        'vendor_response',
        'vendor_responded_at',
        'status',
        'helpful_count',
    ];

    protected $casts = [
        'rating' => 'integer',
        'helpful_count' => 'integer',
        'images' => 'array',
        'vendor_responded_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::created(function ($review) {
            if ($review->vendorProfile) {
                $review->vendorProfile->updateRating();
            }
        });

        static::updated(function ($review) {
            if ($review->vendorProfile) {
                $review->vendorProfile->updateRating();
            }
        });

        static::deleted(function ($review) {
            if ($review->vendorProfile) {
                $review->vendorProfile->updateRating();
            }
        });
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    // Scopes
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeByRating($query, $rating)
    {
        return $query->where('rating', $rating);
    }

    // Helpers
    public function respond(string $response): void
    {
        $this->update([
            'vendor_response' => $response,
            'vendor_responded_at' => now(),
        ]);
    }

    public function approve(): void
    {
        $this->update(['status' => 'approved']);
    }

    public function reject(): void
    {
        $this->update(['status' => 'rejected']);
    }
}
