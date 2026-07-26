<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cart extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'session_id',
        'vendor_profile_id',
    ];

    /**
     * Scope to get cart by session for guests or user for authenticated users.
     */
    public static function resolveForRequest(\Illuminate\Http\Request $request): ?self
    {
        if ($request->user()) {
            return static::where('user_id', $request->user()->id)->first();
        }
        $sessionId = $request->header('X-Guest-Session-Id');
        if ($sessionId) {
            return static::where('session_id', $sessionId)->whereNull('user_id')->first();
        }
        return null;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    public function items()
    {
        return $this->hasMany(CartItem::class);
    }

    public function activeItems()
    {
        return $this->hasMany(CartItem::class)->where('is_saved_for_later', false);
    }

    public function savedItems()
    {
        return $this->hasMany(CartItem::class)->where('is_saved_for_later', true);
    }

    public function getSubtotal(): float
    {
        return $this->activeItems->sum(function ($item) {
            return $item->unit_price * $item->quantity;
        });
    }

    public function getTotalItems(): int
    {
        return $this->activeItems->sum('quantity');
    }

    public function clearCart(): void
    {
        $this->activeItems()->delete();
    }
}
