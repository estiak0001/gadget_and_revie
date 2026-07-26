<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ProductCategory extends Model
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
        return $this->belongsTo(ProductCategory::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(ProductCategory::class, 'parent_id');
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }

    public function attributes()
    {
        return $this->hasMany(CategoryAttribute::class, 'category_id');
    }

    /**
     * Get this category's own attributes plus those inherited from all ancestors.
     * Descendant categories inherit filter attributes defined on any parent.
     */
    public function getInheritedAttributes()
    {
        $categoryIds = collect($this->getBreadcrumb())->pluck('id')->all();

        if (empty($categoryIds)) {
            $categoryIds = [$this->id];
        }

        return CategoryAttribute::with(['values' => function ($q) {
                $q->where('is_active', true)->orderBy('sort_order')->orderBy('value');
            }])
            ->whereIn('category_id', $categoryIds)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeParentCategories($query)
    {
        return $query->whereNull('parent_id');
    }

    /**
     * Get the breadcrumb path (all ancestors) for this category
     * Returns array of categories from root to current
     * This method will fetch parents if they're not already loaded
     */
    public function getBreadcrumb(): array
    {
        $breadcrumb = [];
        $currentId = $this->id;
        $visited = []; // Prevent infinite loops
        
        while ($currentId && !in_array($currentId, $visited)) {
            $visited[] = $currentId;
            
            // Try to load from already-loaded relations
            if ($currentId === $this->id) {
                $category = $this;
            } else {
                // Load fresh from DB if not in current chain
                $category = static::find($currentId);
                if (!$category) break;
            }
            
            array_unshift($breadcrumb, $category);
            $currentId = $category->parent_id;
        }
        
        return $breadcrumb;
    }

    /**
     * Get the full path (slugs) for this category
     * Returns string like "desktop/gaming-desktop/intel"
     */
    public function getPathAttribute(): string
    {
        $breadcrumb = $this->getBreadcrumb();
        return implode('/', array_map(fn($cat) => $cat->slug, $breadcrumb));
    }
}
