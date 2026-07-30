<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'order_number',
        'customer_id',
        'session_id',
        'vendor_profile_id',
        'subtotal',
        'tax',
        'shipping',
        'discount',
        'total',
        'refund_amount',
        'paid_amount',
        'payment_method',
        'payment_status',
        'order_status',
        'customer_notes',
        'vendor_notes',
        'admin_notes',
        'customer_name',
        'customer_phone',
        'customer_email',
        'customer_address',
        'division_id',
        'district_id',
        'area_id',
        'accepted_at',
        'completed_at',
        'cancelled_at',
        'created_by',
    ];

    // Scope to find guest orders by session
    public function scopeBySession($query, string $sessionId)
    {
        return $query->where('session_id', $sessionId)->whereNull('customer_id');
    }

    // Check if order is a guest order
    public function isGuestOrder(): bool
    {
        return is_null($this->customer_id) && !is_null($this->session_id);
    }

    /**
     * True for orders that should allow "guest-style" access — order tracking, receipt/invoice
     * download by order number, no login required. This includes true guest orders (no customer_id
     * at all) as well as orders whose customer_id was silently auto-created from typed checkout
     * details (see User::findOrCreateCustomer()) rather than a real self-registered account the
     * customer can log into.
     */
    public function allowsGuestStyleAccess(): bool
    {
        if ($this->isGuestOrder()) {
            return true;
        }

        return $this->customer_id !== null && (bool) $this->customer?->is_auto_created;
    }

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'shipping' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'accepted_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    protected $appends = ['is_payment_ledger_synced', 'outstanding_receivable'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($order) {
            if (empty($order->order_number)) {
                $order->order_number = 'ORD-' . date('Ymd') . '-' . strtoupper(Str::random(6));
            }
        });
    }

    // Relationships
    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function vendorProfile()
    {
        return $this->belongsTo(VendorProfile::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
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
        return $this->hasMany(OrderItem::class);
    }

    public function serviceIntake()
    {
        return $this->hasOne(ServiceIntake::class);
    }

    public function paymentNotices()
    {
        return $this->hasMany(PaymentNotice::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }

    public function review()
    {
        return $this->hasOne(Review::class);
    }

    // Scopes
    public function scopeByStatus($query, $status)
    {
        return $query->where('order_status', $status);
    }

    public function scopeByPaymentStatus($query, $status)
    {
        return $query->where('payment_status', $status);
    }

    public function scopeByCustomer($query, $customerId)
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeByVendor($query, $vendorProfileId)
    {
        return $query->where('vendor_profile_id', $vendorProfileId);
    }

    public function scopePending($query)
    {
        return $query->where('order_status', 'pending');
    }

    public function scopeCompleted($query)
    {
        return $query->where('order_status', 'completed');
    }

    public function scopeCancelled($query)
    {
        return $query->where('order_status', 'cancelled');
    }

    // Helpers
    public function isPending(): bool
    {
        return $this->order_status === 'pending';
    }

    public function isAccepted(): bool
    {
        return $this->order_status === 'accepted';
    }

    public function isInProgress(): bool
    {
        return $this->order_status === 'in_progress';
    }

    public function isCompleted(): bool
    {
        return $this->order_status === 'completed';
    }

    public function isCancelled(): bool
    {
        return $this->order_status === 'cancelled';
    }

    public function isPaid(): bool
    {
        return $this->payment_status === 'paid';
    }

    public function canBeCancelled(): bool
    {
        return in_array($this->order_status, ['pending', 'accepted']);
    }

    public function canBeReviewed(): bool
    {
        return $this->order_status === 'completed' && !$this->review()->exists();
    }

    /**
     * A service intake's price is confirmed once it leaves the early
     * "received"/"in_progress" stages. Used to gate invoice availability.
     */
    public function isServicePricePending(): bool
    {
        // Accessing the dynamic property lazy-loads once and caches the result,
        // so repeated calls (and receiptAvailable) reuse the same relation.
        $intake = $this->serviceIntake;

        return $intake !== null
            && in_array($intake->status, ['received', 'in_progress'], true);
    }

    /**
     * The service receipt is available whenever the order has a linked intake
     * (the customer can download it before the price is confirmed).
     */
    public function receiptAvailable(): bool
    {
        return $this->serviceIntake !== null;
    }

    /**
     * An invoice is available for ordinary orders, and for service orders only
     * after the price has been confirmed on the linked intake.
     */
    public function invoiceAvailable(): bool
    {
        return !$this->isServicePricePending();
    }

    public function accept(): void
    {
        $this->update([
            'order_status' => 'accepted',
            'accepted_at' => now(),
        ]);
    }

    public function complete(): void
    {
        $this->update([
            'order_status' => 'completed',
            'completed_at' => now(),
        ]);
    }

    public function cancel(): void
    {
        $this->update([
            'order_status' => 'cancelled',
            'cancelled_at' => now(),
        ]);
    }

    /** How much of the order total the customer still owes. */
    public function getOutstandingReceivableAttribute(): float
    {
        return round((float) $this->total - (float) $this->paid_amount, 2);
    }

    /** Orders can be edited any time before they're completed, cancelled, or refunded. */
    public function canBeEdited(): bool
    {
        return !in_array($this->order_status, ['completed', 'cancelled', 'refunded'], true);
    }

    /**
     * Items/pricing can only be edited while the sale hasn't been recognized in the ledger yet —
     * once it has, the AR/revenue journal entries are posted against the order's current total, so
     * changing items or pricing afterwards would desync the ledger from the order. Checked against
     * the actual ledger state (not paid_amount) so this can never drift out of sync with the books.
     */
    public function canEditItemsAndPricing(): bool
    {
        return $this->canBeEdited() && !$this->hasRevenueBeenRecognized();
    }

    /** True once the one-time sale/revenue-recognition entry has been posted for this order. */
    public function hasRevenueBeenRecognized(): bool
    {
        return JournalEntryLine::whereHas('journalEntry', fn ($q) => $q->where('reference_type', 'Order')->where('reference_id', $this->id)->where('is_reversal', false))
            ->whereHas('account', fn ($q) => $q->where('code', '4000'))
            ->exists();
    }

    /** True once there's nothing pending to sync — either not yet paid at all, or already recognized. */
    public function isPaymentLedgerSynced(): bool
    {
        if (!in_array($this->payment_status, ['paid', 'partially_paid', 'verified'], true)) {
            return true;
        }

        return $this->hasRevenueBeenRecognized();
    }

    public function getIsPaymentLedgerSyncedAttribute(): bool
    {
        return $this->isPaymentLedgerSynced();
    }

    /**
     * Record a payment against this order — full or partial. The first payment ever recorded
     * also recognizes the full sale (Dr Accounts Receivable / Cr Sales Revenue + Tax Payable);
     * every payment (first or subsequent) additionally posts Dr Cash / Cr Accounts Receivable
     * for the amount actually received. `paid_amount` and `payment_status` are updated to match.
     *
     * Safe to call repeatedly for the same order as more partial payments come in. Throws if the
     * amount is invalid or would overpay the order.
     *
     * @return JournalEntry[] the entries posted by this call (one or two)
     */
    public function recordPayment(float $amount, ?User $user = null): array
    {
        $amount = round($amount, 2);
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Payment amount must be greater than zero');
        }
        if ($amount > $this->outstanding_receivable) {
            throw new \InvalidArgumentException("Payment amount cannot exceed the outstanding balance of {$this->outstanding_receivable}");
        }

        $entries = [];

        if (!$this->hasRevenueBeenRecognized()) {
            $entries = array_merge($entries, $this->recognizeRevenueAndCogs($user));
        }

        $entries[] = JournalEntry::post(now()->toDateString(), 'Order', $this->id, "Payment received for order #{$this->order_number}", [
            ['account_code' => '1000', 'debit' => $amount],
            ['account_code' => '1010', 'credit' => $amount],
        ], $user);

        $newPaidAmount = round((float) $this->paid_amount + $amount, 2);
        $this->update([
            'paid_amount' => $newPaidAmount,
            'payment_status' => $newPaidAmount >= (float) $this->total ? 'paid' : 'partially_paid',
        ]);

        return $entries;
    }

    /**
     * Post the sale-recognition (Dr Accounts Receivable / Cr Sales Revenue + Tax Payable) and
     * matching Cost of Goods Sold entries for this order's *current* items/totals. Pure posting —
     * deliberately has no `hasRevenueBeenRecognized()` guard, unlike its only guarded call site in
     * `recordPayment()`: that check stays true forever once revenue has ever been posted for this
     * order (it looks for the original entry's continued existence, which reversing doesn't
     * change), so it can never be reused here to guard a re-recognition after an admin amendment.
     *
     * @return JournalEntry[] the entries posted by this call (one or two)
     */
    public function recognizeRevenueAndCogs(?User $user = null): array
    {
        $entries = [];

        $lines = [
            ['account_code' => '1010', 'debit' => $this->total],
            ['account_code' => '4000', 'credit' => $this->subtotal + $this->shipping - $this->discount],
        ];
        if ($this->tax > 0) {
            $lines[] = ['account_code' => '2020', 'credit' => $this->tax];
        }
        $entries[] = JournalEntry::post(now()->toDateString(), 'Order', $this->id, "Order #{$this->order_number} sale recognized", $lines, $user);

        // Cost of Goods Sold, recognized at the same moment as the revenue it matches —
        // same reference ('Order', $this->id) as every other entry here, so refund/cancel's
        // JournalEntry::reverseAllFor() reverses this alongside the revenue automatically.
        // Skipped entirely if 0 (product never received via a costed Purchase Order, e.g. an
        // instant-created or always_in_stock item with no average_cost set) — matches the
        // skip-if-zero pattern already used by PurchaseOrder::postReceiptJournalEntry().
        $this->loadMissing('items.product');
        $cogs = round($this->items
            ->where('item_type', 'product')
            ->sum(fn ($item) => $item->product ? $item->quantity * (float) ($item->product->average_cost ?? 0) : 0), 2);
        if ($cogs > 0) {
            $entries[] = JournalEntry::post(now()->toDateString(), 'Order', $this->id, "Order #{$this->order_number} cost of goods sold", [
                ['account_code' => '5000', 'debit' => $cogs],
                ['account_code' => '1020', 'credit' => $cogs],
            ], $user);
        }

        return $entries;
    }

    /**
     * True once the order is paid (revenue recognized) but not yet completed/cancelled/refunded —
     * items/pricing are normally locked at this point (see `canEditItemsAndPricing()`), but a
     * super_admin can still amend the order; the caller is responsible for checking the role.
     */
    public function requiresSuperAdminToAmend(): bool
    {
        return $this->canBeEdited() && $this->hasRevenueBeenRecognized();
    }
}
