<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class VendorProfile extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'business_name',
        'slug',
        'owner_name',
        'description',
        'logo',
        'banner',
        'address',
        'google_maps_link',
        'division_id',
        'district_id',
        'area_id',
        'bkash_number',
        'nagad_number',
        'bank_account_name',
        'bank_name',
        'bank_account_number',
        'bank_branch',
        'payment_instructions',
        'trade_license',
        'nid_number',
        'nid_front_image',
        'nid_back_image',
        'status',
        'admin_notes',
        'rejection_reason',
        'rating',
        'total_reviews',
        'total_orders',
        'is_featured',
        'is_verified',
        'approved_at',
    ];

    protected $casts = [
        'rating' => 'decimal:2',
        'total_reviews' => 'integer',
        'total_orders' => 'integer',
        'is_featured' => 'boolean',
        'is_verified' => 'boolean',
        'approved_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($vendor) {
            if (empty($vendor->slug)) {
                $vendor->slug = Str::slug($vendor->business_name) . '-' . Str::random(5);
            }
        });
    }

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
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

    public function serviceAreas()
    {
        return $this->hasMany(VendorServiceArea::class);
    }

    public function serviceCategories()
    {
        return $this->belongsToMany(ServiceCategory::class, 'vendor_service_categories');
    }

    public function services()
    {
        return $this->hasMany(Service::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function paymentNotices()
    {
        return $this->hasMany(PaymentNotice::class);
    }

    public function inventoryLogs()
    {
        return $this->hasMany(InventoryLog::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeVerified($query)
    {
        return $query->where('is_verified', true);
    }

    public function scopeByLocation($query, $divisionId = null, $districtId = null, $areaId = null)
    {
        return $query
            ->when($divisionId, fn($q) => $q->where('division_id', $divisionId))
            ->when($districtId, fn($q) => $q->where('district_id', $districtId))
            ->when($areaId, fn($q) => $q->where('area_id', $areaId));
    }

    // Helpers
    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function updateRating(): void
    {
        $this->rating = $this->reviews()->where('is_approved', true)->avg('rating') ?? 0;
        $this->total_reviews = $this->reviews()->where('is_approved', true)->count();
        $this->save();
    }

    public function getPaymentInstructions(string $method): ?string
    {
        $instructions = [];

        switch ($method) {
            case 'bkash':
                if ($this->bkash_number) {
                    $instructions[] = "bKash Number: {$this->bkash_number}";
                }
                break;
            case 'nagad':
                if ($this->nagad_number) {
                    $instructions[] = "Nagad Number: {$this->nagad_number}";
                }
                break;
            case 'bank_transfer':
                if ($this->bank_account_number) {
                    $instructions[] = "Bank: {$this->bank_name}";
                    $instructions[] = "Account Name: {$this->bank_account_name}";
                    $instructions[] = "Account Number: {$this->bank_account_number}";
                    $instructions[] = "Branch: {$this->bank_branch}";
                }
                break;
        }

        if ($this->payment_instructions) {
            $instructions[] = $this->payment_instructions;
        }

        return !empty($instructions) ? implode("\n", $instructions) : null;
    }
}
