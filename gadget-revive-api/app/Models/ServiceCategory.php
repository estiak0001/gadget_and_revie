<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ServiceCategory extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'name_bn',
        'slug',
        'description',
        'icon',
        'image',
        'parent_id',
        'sort_order',
        'is_active',
        'is_featured',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($category) {
            if (empty($category->slug)) {
                $baseSlug = Str::slug($category->name);
                $slug = $baseSlug;
                $count = 1;
                while (static::withTrashed()->where('slug', $slug)->exists()) {
                    $slug = $baseSlug . '-' . $count++;
                }
                $category->slug = $slug;
            }
        });
    }

    public function parent()
    {
        return $this->belongsTo(ServiceCategory::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(ServiceCategory::class, 'parent_id');
    }

    public function services()
    {
        return $this->hasMany(Service::class, 'category_id');
    }

    public function vendors()
    {
        return $this->belongsToMany(VendorProfile::class, 'vendor_service_categories', 'service_category_id', 'vendor_profile_id');
    }

    /**
     * This category's id plus every descendant's id (recursive). Storefront category pages are
     * "flat" — a category page shows every service anywhere in its subtree, not just direct
     * children — so this is the single source of truth for that subtree, shared by the services
     * list query (ServiceController) and the "starting from" price stat (CategoryController).
     */
    public function allDescendantIds(): array
    {
        $ids = [$this->id];
        foreach (static::where('parent_id', $this->id)->get() as $child) {
            $ids = array_merge($ids, $child->allDescendantIds());
        }
        return $ids;
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeParentCategories($query)
    {
        return $query->whereNull('parent_id');
    }

    public function getBreadcrumb(): array
    {
        $breadcrumb = [];
        $visited    = [];
        $current    = $this;

        while ($current) {
            if (in_array($current->id, $visited)) {
                break;
            }
            $visited[] = $current->id;
            array_unshift($breadcrumb, [
                'id'   => $current->id,
                'name' => $current->name,
                'slug' => $current->slug,
            ]);

            if ($current->parent_id === null) {
                break;
            }

            if ($current->relationLoaded('parent') && $current->parent !== null) {
                $current = $current->parent;
            } else {
                $current = ServiceCategory::find($current->parent_id);
            }
        }

        return $breadcrumb;
    }

    public function getPathAttribute(): string
    {
        return implode('/', array_map(fn ($cat) => $cat['slug'], $this->getBreadcrumb()));
    }
}
