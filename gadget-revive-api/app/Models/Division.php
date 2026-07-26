<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Division extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'name_bn',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function districts()
    {
        return $this->hasMany(District::class);
    }

    public function vendorProfiles()
    {
        return $this->hasMany(VendorProfile::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
