<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'vendor_profile_id',
        'category_id',
        'brand_id',
        'sku',
        'name',
        'name_bn',
        'slug',
        'description',
        'short_description',
        'price',
        'discount_price',
        'stock_qty',
        'low_stock_threshold',
        'always_in_stock',
        'average_cost',
        'unit',
        'image',
        'gallery',
        'specifications',
        'brand',
        'model',
        'warranty',
        'is_active',
        'is_draft',
        'is_featured',
        'sort_order',
        'created_by',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_price' => 'decimal:2',
        'stock_qty' => 'integer',
        'low_stock_threshold' => 'integer',
        'always_in_stock' => 'boolean',
        'average_cost' => 'decimal:2',
        'gallery' => 'array',
        'specifications' => 'array',
        'is_active' => 'boolean',
        'is_draft' => 'boolean',
        'is_featured' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($product) {
            if (empty($product->slug)) {
                $product->slug = Str::slug($product->name) . '-' . Str::random(5);
            }
            if (empty($product->sku)) {
                $product->sku = 'SKU-' . strtoupper(Str::random(8));
            }
        });
    }

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function brand()
    {
        return $this->belongsTo(ProductBrand::class, 'brand_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function cartItems()
    {
        return $this->hasMany(CartItem::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function inventoryLogs()
    {
        return $this->hasMany(InventoryLog::class);
    }

    public function attributeValues()
    {
        return $this->hasMany(ProductAttributeValue::class, 'product_id');
    }

    public function selectedAttributeValues()
    {
        return $this->belongsToMany(
            AttributeValue::class,
            'product_attribute_values',
            'product_id',
            'attribute_value_id'
        )->withPivot('attribute_id', 'text_value');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->whereHas('category', function ($q) {
                $q->where('is_active', true);
            });
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeInStock($query)
    {
        return $query->where(fn ($q) => $q->where('always_in_stock', true)->orWhere('stock_qty', '>', 0));
    }

    public function scopeLowStock($query)
    {
        return $query->where('always_in_stock', false)->whereColumn('stock_qty', '<=', 'low_stock_threshold');
    }

    public function scopeByCategory($query, $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    public function scopeByVendor($query, $vendorProfileId)
    {
        return $query->where('vendor_profile_id', $vendorProfileId);
    }

    // Helpers
    public function getCurrentPrice(): float
    {
        return $this->discount_price ?? $this->price;
    }

    public function hasDiscount(): bool
    {
        return $this->discount_price !== null && $this->discount_price < $this->price;
    }

    public function isInStock(): bool
    {
        return $this->always_in_stock || $this->stock_qty > 0;
    }

    public function isLowStock(): bool
    {
        return !$this->always_in_stock && $this->stock_qty <= $this->low_stock_threshold;
    }

    public function canFulfill(int $quantity): bool
    {
        return $this->always_in_stock || $this->stock_qty >= $quantity;
    }

    public function decrementStock(int $quantity): void
    {
        $this->decrement('stock_qty', $quantity);
    }

    public function incrementStock(int $quantity): void
    {
        $this->increment('stock_qty', $quantity);
    }

    /**
     * Recompute the weighted-average cost as new stock arrives from a Purchase Order. Must be
     * called with the quantity/cost of the *incoming* batch, before incrementStock() runs — the
     * math needs stock_qty as it stood immediately before this receipt.
     */
    public function recordPurchaseReceipt(int $qty, float $unitCost): void
    {
        // Guard against negative stock (possible on always_in_stock items sold past zero) so it
        // can't distort the average — treat "nothing on hand" as the floor for this calculation.
        $currentQty = max(0, $this->stock_qty);
        $currentValue = $currentQty * (float) ($this->average_cost ?? 0);
        $newQty = $currentQty + $qty;

        $this->average_cost = $newQty > 0
            ? round(($currentValue + $qty * $unitCost) / $newQty, 2)
            : $unitCost;
        $this->save();
    }
}
