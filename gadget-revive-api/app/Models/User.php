<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'status',
        'phone_verification_code',
        'phone_verified_at',
        'avatar',
        'is_auto_created',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'phone_verification_code',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_auto_created' => 'boolean',
        ];
    }

    /**
     * Find an existing customer by email or phone, or create a new one — used whenever an order
     * is placed (admin manual order, guest checkout) with typed customer details but no explicit
     * customer_id, so that customer shows up in the Customers page instead of only ever existing
     * as free-text on the order. Returns null if there's no name to create an account with and no
     * existing match. Newly created accounts are flagged `is_auto_created` (see migration comment)
     * so guest-style access (order tracking, receipt/invoice download by order number) keeps
     * working for them even once they're linked via `orders.customer_id`.
     */
    public static function findOrCreateCustomer(?string $name, ?string $phone, ?string $email): ?self
    {
        if ($email) {
            $existing = self::where('email', $email)->where('role', 'customer')->first();
            if ($existing) {
                return $existing;
            }
        }

        if ($phone) {
            $existing = self::where('phone', $phone)->where('role', 'customer')->first();
            if ($existing) {
                return $existing;
            }
        }

        if (!$name) {
            return null;
        }

        return self::create([
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'password' => Str::random(32),
            'role' => 'customer',
            'status' => 'active',
            'is_auto_created' => true,
        ]);
    }

    // Relationships
    public function vendorProfile()
    {
        return $this->hasOne(VendorProfile::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'customer_id');
    }

    public function carts()
    {
        return $this->hasMany(Cart::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class, 'customer_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'actor_id');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeVendors($query)
    {
        return $query->where('role', 'vendor');
    }

    public function scopeCustomers($query)
    {
        return $query->where('role', 'customer');
    }

    public function scopeAdmins($query)
    {
        return $query->where('role', 'admin');
    }

    // Helpers
    // "Admin-tier" — every call site uses this to mean "should this account get admin-panel-level
    // access/visibility," which staff and super_admin need just as much as the base 'admin' tier
    // does (see routes/api.php's role:admin,staff,super_admin middleware groups, which already
    // treat all three as equivalent). A literal role==='admin' check silently locked staff and
    // super_admin accounts out of invoice downloads, receipt downloads, vendor dashboard admin
    // views, and admin_notes/vendor_notes visibility.
    public function isAdmin(): bool
    {
        return in_array($this->role, ['admin', 'staff', 'super_admin'], true);
    }

    public function isVendor(): bool
    {
        return $this->role === 'vendor';
    }

    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    public function isVerified(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
