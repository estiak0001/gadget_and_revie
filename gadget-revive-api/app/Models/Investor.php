<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Investor extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'phone', 'email', 'address', 'notes', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function investments(): HasMany
    {
        return $this->hasMany(Investment::class);
    }

    /** How much capital this investor currently has in the business — contributions minus returns. */
    public function getBalanceAttribute(): float
    {
        $contributions = (float) $this->investments()->where('type', 'contribution')->sum('amount');
        $returns = (float) $this->investments()->where('type', 'return')->sum('amount');

        return round($contributions - $returns, 2);
    }
}
