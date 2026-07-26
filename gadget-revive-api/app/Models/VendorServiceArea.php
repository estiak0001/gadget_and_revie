<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VendorServiceArea extends Model
{
    use HasFactory;

    protected $fillable = [
        'vendor_profile_id',
        'division_id',
        'district_id',
        'area_id',
        'extra_charge',
        'is_active',
    ];

    protected $casts = [
        'extra_charge' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    public function division()
    {
        return $this->belongsTo(Division::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function area()
    {
        return $this->belongsTo(Area::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
