<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AttributeValue extends Model
{
    use HasFactory;

    protected $fillable = [
        'attribute_id',
        'value',
        'value_bn',
        'slug',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($value) {
            if (empty($value->slug)) {
                $value->slug = self::generateUniqueSlug($value->attribute_id, $value->value);
            }
        });
    }

    public static function generateUniqueSlug(int $attributeId, string $value): string
    {
        $baseSlug = Str::slug($value);
        if (empty($baseSlug)) {
            $baseSlug = 'val';
        }
        $slug = $baseSlug;
        $count = 1;
        while (self::where('attribute_id', $attributeId)->where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $count++;
        }
        return $slug;
    }

    public function attribute()
    {
        return $this->belongsTo(CategoryAttribute::class, 'attribute_id');
    }

    public function productAttributeValues()
    {
        return $this->hasMany(ProductAttributeValue::class, 'attribute_value_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
