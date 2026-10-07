<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ServiceIntake extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'receipt_number',
        'customer_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'branch_location_id',
        'division_id',
        'district_id',
        'area_id',
        'received_by_name',
        'status',
        'work_status',
        'estimated_cost',
        'amount',
        'non_refundable_amount',
        'non_refundable_reason',
        'reference_name',
        'commission_amount',
        'received_at',
        'expected_delivery_at',
        'delivered_at',
        'notes',
        'admin_notes',
        'customer_feedback',
        'order_id',
        'created_by',
    ];

    protected $casts = [
        'estimated_cost'        => 'decimal:2',
        'amount'                => 'decimal:2',
        'non_refundable_amount' => 'decimal:2',
        'commission_amount'     => 'decimal:2',
        'received_at'           => 'datetime',
        'expected_delivery_at'  => 'date',
        'delivered_at'          => 'datetime',
    ];

    /** Computed, not stored -- see getDaysUntilEstimateAttribute(). */
    protected $appends = ['days_until_estimate'];

    /**
     * "Days" column: how many days remain until expected_delivery_at (negative once overdue).
     * Null when no estimate date has been set yet.
     */
    public function getDaysUntilEstimateAttribute(): ?int
    {
        if (!$this->expected_delivery_at) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays($this->expected_delivery_at->copy()->startOfDay(), false);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($intake) {
            if (empty($intake->receipt_number)) {
                $intake->receipt_number = 'RCV-PENDING';
            }
            if (empty($intake->received_at)) {
                $intake->received_at = now();
            }
        });

        static::created(function ($intake) {
            if ($intake->receipt_number === 'RCV-PENDING') {
                $intake->updateQuietly([
                    'receipt_number' => 'RCV-' . str_pad($intake->id, 8, '0', STR_PAD_LEFT),
                ]);
            }
        });
    }

    // Relationships
    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function branchLocation()
    {
        return $this->belongsTo(BranchLocation::class);
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

    public function items()
    {
        return $this->hasMany(ServiceIntakeItem::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    // Helpers
    public function isLinkedToOrder(): bool
    {
        return !is_null($this->order_id);
    }

    public function isFinalized(): bool
    {
        return $this->status === 'converted';
    }

    /** A walk-in intake (no pre-existing order) may be converted into a new order. */
    public function canBeConverted(): bool
    {
        return is_null($this->order_id) && !in_array($this->status, ['converted', 'cancelled', 'returned']);
    }

    /** A linked intake may have its price confirmed back onto the existing order. */
    public function canConfirmPrice(): bool
    {
        return !is_null($this->order_id) && !in_array($this->status, ['cancelled', 'returned']);
    }

    /** 'returned' is a terminal state too -- the device already left, same as 'cancelled'. */
    public function isLocked(): bool
    {
        return in_array($this->status, ['converted', 'cancelled', 'returned']);
    }
}
