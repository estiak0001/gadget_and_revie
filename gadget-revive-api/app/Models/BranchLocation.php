<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BranchLocation extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'address',
        'phone',
        'email',
        'hours',
        'services',
        'map_url',
        'map_embed_url',
        'latitude',
        'longitude',
        'is_featured',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'services'    => 'array',
        'is_featured' => 'boolean',
        'is_active'   => 'boolean',
        'latitude'    => 'float',
        'longitude'   => 'float',
        'sort_order'  => 'integer',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }
}
