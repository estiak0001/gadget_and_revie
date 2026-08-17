<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Http\Resources\VendorProfileResource;
use App\Http\Resources\OrderResource;
use App\Http\Resources\ReviewResource;
use App\Http\Resources\TicketResource;
use App\Http\Resources\TicketMessageResource;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\CmsPageResource;
use App\Http\Resources\BannerResource;
use App\Http\Resources\FaqResource;
use App\Http\Resources\NotificationResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ProductBrandResource;
use App\Http\Resources\ServiceResource;
use App\Http\Resources\SiteSettingResource;
use App\Models\AuditLog;
use App\Models\Banner;
use App\Models\CmsPage;
use App\Models\Expense;
use App\Models\Faq;
use App\Models\InventoryLog;
use App\Models\JournalEntry;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductSerial;
use App\Models\ProductBrand;
use App\Models\Review;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\SiteSetting;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use App\Models\VendorProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminController extends BaseController
{
    // ========== DASHBOARD ==========

    /**
     * Get admin dashboard statistics
     */
    public function dashboard(Request $request): JsonResponse
    {
        // ── Date range (defaults to the last 30 days) ──
        $endDate = $request->filled('end_date')
            ? \Carbon\Carbon::parse($request->end_date)->endOfDay()
            : now()->endOfDay();
        $startDate = $request->filled('start_date')
            ? \Carbon\Carbon::parse($request->start_date)->startOfDay()
            : now()->subDays(29)->startOfDay();

        // Previous period of equal length (for trend comparison)
        $rangeDays = $startDate->diffInDays($endDate) + 1;
        $prevEndDate = (clone $startDate)->subSecond();
        $prevStartDate = (clone $prevEndDate)->subDays($rangeDays - 1)->startOfDay();

        $calcTrend = function ($current, $previous) {
            if ($previous == 0) {
                return $current > 0 ? 100.0 : 0.0;
            }
            return round((($current - $previous) / $previous) * 100, 1);
        };

        // User statistics (all-time totals for the cards)
        $userStats = User::selectRaw('
            COUNT(*) as total_users,
            SUM(CASE WHEN role = "customer" THEN 1 ELSE 0 END) as total_customers,
            SUM(CASE WHEN role = "vendor" THEN 1 ELSE 0 END) as total_vendors,
            SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_users
        ')->first();

        // Vendor statistics (all-time totals)
        $vendorStats = VendorProfile::selectRaw('
            COUNT(*) as total_vendors,
            SUM(CASE WHEN status = "approved" THEN 1 ELSE 0 END) as approved_vendors,
            SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_vendors,
            SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as rejected_vendors
        ')->first();

        // Order/revenue statistics for the selected period.
        // total_revenue only counts orders whose sale has actually been recognized in the ledger
        // (payment_status paid/partially_paid/verified) and excludes refunded/cancelled/never-paid
        // orders — otherwise a refunded order's full amount still shows up as "revenue" here even
        // though the ledger has already reversed it to zero, creating a permanent gap against the
        // Accounting section's Income Statement and Cash Balance figures.
        $orderStats = Order::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(CASE WHEN payment_status IN ("paid", "partially_paid", "verified") THEN total ELSE 0 END) as total_revenue,
                SUM(CASE WHEN order_status = "completed" THEN total ELSE 0 END) as completed_revenue,
                SUM(CASE WHEN order_status = "pending" THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN order_status = "completed" THEN 1 ELSE 0 END) as completed_orders,
                SUM(CASE WHEN order_status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders
            ')
            ->first();

        // Previous-period figures for trends
        $prevOrders = Order::whereBetween('created_at', [$prevStartDate, $prevEndDate])
            ->selectRaw('COUNT(*) as total_orders, SUM(CASE WHEN payment_status IN ("paid", "partially_paid", "verified") THEN total ELSE 0 END) as total_revenue')
            ->first();
        $newUsers = User::whereBetween('created_at', [$startDate, $endDate])->count();
        $prevNewUsers = User::whereBetween('created_at', [$prevStartDate, $prevEndDate])->count();
        $newVendors = VendorProfile::whereBetween('created_at', [$startDate, $endDate])->count();
        $prevNewVendors = VendorProfile::whereBetween('created_at', [$prevStartDate, $prevEndDate])->count();

        $periodRevenue = (float) ($orderStats->total_revenue ?? 0);
        $prevRevenue = (float) ($prevOrders->total_revenue ?? 0);

        // Daily revenue + order count for the chart (within the selected range)
        $revenueChart = Order::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw('DATE(created_at) as date, SUM(CASE WHEN order_status = "completed" THEN total ELSE 0 END) as revenue, COUNT(*) as orders')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'revenue' => (float) $row->revenue,
                'orders' => (int) $row->orders,
            ]);

        // Product & Service counts
        $productCount = Product::count();
        $serviceCount = Service::count();

        // Pending items
        $pendingVendors = VendorProfile::where('status', 'pending')->count();
        $pendingTickets = Ticket::where('status', 'open')->count();
        $pendingReviews = Review::where('status', 'pending')->count();

        // Recent activity
        $recentOrders = Order::with(['customer', 'vendorProfile'])
            ->latest()
            ->take(5)
            ->get();

        $recentVendors = VendorProfile::with('user')
            ->where('status', 'pending')
            ->latest()
            ->take(5)
            ->get();

        // Current cash on hand — a liquidity snapshot to sit alongside the period's revenue figure
        // (revenue is a P&L number; this is "how much money do we actually have right now").
        $cashAccount = \App\Models\ChartOfAccount::where('code', '1000')->first();
        $currentCashBalance = $cashAccount ? round($cashAccount->balanceAsOf(now()->toDateString()), 2) : 0.0;

        return $this->success([
            'statistics' => [
                'users' => [
                    'total' => (int) $userStats->total_users,
                    'customers' => (int) $userStats->total_customers,
                    'vendors' => (int) $userStats->total_vendors,
                    'active' => (int) $userStats->active_users,
                ],
                'vendors' => [
                    'total' => (int) $vendorStats->total_vendors,
                    'approved' => (int) $vendorStats->approved_vendors,
                    'pending' => (int) $vendorStats->pending_vendors,
                    'rejected' => (int) $vendorStats->rejected_vendors,
                ],
                'orders' => [
                    'total' => (int) $orderStats->total_orders,
                    'pending' => (int) $orderStats->pending_orders,
                    'completed' => (int) $orderStats->completed_orders,
                    'cancelled' => (int) $orderStats->cancelled_orders,
                ],
                'revenue' => [
                    'total' => $periodRevenue,
                    'completed' => (float) ($orderStats->completed_revenue ?? 0),
                ],
                'cash_balance' => [
                    'current' => $currentCashBalance,
                ],
                'catalog' => [
                    'products' => $productCount,
                    'services' => $serviceCount,
                ],
                'pending_actions' => [
                    'vendors' => $pendingVendors,
                    'tickets' => $pendingTickets,
                    'reviews' => $pendingReviews,
                ],
            ],
            'trends' => [
                'revenue_change' => $calcTrend($periodRevenue, $prevRevenue),
                'orders_change'  => $calcTrend((int) $orderStats->total_orders, (int) ($prevOrders->total_orders ?? 0)),
                'users_change'   => $calcTrend($newUsers, $prevNewUsers),
                'vendors_change' => $calcTrend($newVendors, $prevNewVendors),
            ],
            'revenue_chart' => $revenueChart,
            'period' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'recent_orders' => OrderResource::collection($recentOrders),
            'pending_vendors' => VendorProfileResource::collection($recentVendors),
        ]);
    }

    // ========== USER MANAGEMENT ==========

    /**
     * List all users
     */
    public function users(Request $request): JsonResponse
    {
        $query = User::with(['vendorProfile', 'roles']);

        // Filter by role — accepts a single role or a comma-separated list (e.g. the admin
        // panel's "Staff & Admins" tab passes role=staff,admin,super_admin).
        if ($request->has('role')) {
            $roles = array_filter(array_map('trim', explode(',', $request->role)));
            $query->whereIn('role', $roles);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $users = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($users);
    }

    /**
     * Get user details
     */
    public function userShow(int $id): JsonResponse
    {
        $user = User::with(['vendorProfile', 'orders', 'reviews'])->findOrFail($id);

        return $this->success(new UserResource($user));
    }

    /**
     * Update user status
     */
    public function userUpdateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:active,inactive,suspended',
            'reason' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();
        $user = User::findOrFail($id);

        // Prevent admin from changing own status
        if ($user->id === $admin->id) {
            return $this->error('Cannot change your own status', 400);
        }

        // Only a super_admin can suspend/activate another super_admin account.
        if ($user->role === 'super_admin' && !$admin->hasRole('super_admin')) {
            return $this->error('Only a super admin can change a super admin account\'s status', 403);
        }

        $oldStatus = $user->status;
        $user->update(['status' => $request->status]);

        AuditLog::log($admin, 'update_user_status', 'User', $user->id, [
            'status' => $oldStatus,
        ], [
            'status' => $request->status,
            'reason' => $request->reason,
        ], "User status changed from {$oldStatus} to {$request->status}");

        // Notify user
        Notification::notify(
            $user,
            'account_status_changed',
            'Account Status Changed',
            "Your account status has been changed to {$request->status}",
            ['status' => $request->status, 'reason' => $request->reason],
            '/account'
        );

        return $this->success(new UserResource($user->fresh()), 'User status updated');
    }

    /**
     * Create user (admin)
     */
    public function userStore(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|unique:users,phone',
            'password' => 'required|string|min:8',
            'role' => ['required', $this->roleExistsRule()],
            'status' => 'in:active,inactive,suspended',
        ]);

        $admin = $request->user();
        $selectedRole = $request->role;

        // Only a super_admin can create another privileged account (admin/super_admin) — a
        // regular admin can still create 'staff' accounts (and any custom role, which is always
        // staff-tier under the hood — see syncSelectedRole), since staff is meant to be the
        // restricted tier admins manage day-to-day, not a peer/superior tier.
        if (in_array($selectedRole, ['admin', 'super_admin'], true) && !$admin->hasRole('super_admin')) {
            return $this->error('Only a super admin can create admin or super admin accounts', 403);
        }

        $data = $request->only(['name', 'email', 'phone']);
        $data['role'] = $this->tierForRole($selectedRole);
        $data['password'] = bcrypt($request->password);
        $data['status'] = $request->get('status', 'active');
        $data['email_verified_at'] = now();

        $user = User::create($data);
        $this->syncSelectedRole($user, $selectedRole);

        AuditLog::log($admin, 'create_user', 'User', $user->id, null, $user->toArray(), 'User created by admin');

        return $this->created(new UserResource($user), 'User created');
    }

    /**
     * Update user (admin)
     */
    public function userUpdate(Request $request, int $id): JsonResponse
    {
        // Phone-only accounts (customers who registered without an email) round-trip through
        // this form with email = '' rather than absent — normalize to null so 'sometimes' skips
        // it instead of failing format validation, which would otherwise block *any* edit
        // (including an unrelated role change) on those accounts.
        if ($request->has('email') && $request->email === '') {
            $request->merge(['email' => null]);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|nullable|email|unique:users,email,' . $id,
            'phone' => 'sometimes|string|unique:users,phone,' . $id,
            'role' => ['sometimes', $this->roleExistsRule()],
            'status' => 'sometimes|in:active,inactive,suspended',
        ]);

        $admin = $request->user();
        $user = User::findOrFail($id);
        $selectedRole = $request->input('role');

        // The edit form always resubmits the role field alongside name/email/phone/status, so
        // "is a role actually being changed" must compare values, not just check the key is
        // present — otherwise every self-edit (even just renaming yourself) would look like a
        // role-change attempt. Compare against the effective role (custom role if one's assigned,
        // otherwise the tier) since users.role only ever stores a tier name.
        $currentEffectiveRole = $user->roles->pluck('name')->first() ?? $user->role;
        $roleIsActuallyChanging = $request->has('role') && $selectedRole !== $currentEffectiveRole;

        // Prevent admin from changing their own role (but editing your own other fields is fine).
        if ($user->id === $admin->id && $roleIsActuallyChanging) {
            return $this->error('Cannot change your own role', 400);
        }

        // Any admin-tier account can edit another 'admin' account (peers) — only a super_admin
        // account is protected from everyone but another super_admin. Promoting someone *to*
        // admin/super_admin is a separate, still super_admin-only concern (role assignment).
        $targetIsSuperAdmin = $user->role === 'super_admin';
        $promotingToPrivileged = $roleIsActuallyChanging && in_array($selectedRole, ['admin', 'super_admin'], true);
        if (($targetIsSuperAdmin || $promotingToPrivileged) && !$admin->hasRole('super_admin')) {
            return $this->error('Only a super admin can edit a super admin account, or promote a user to admin/super admin', 403);
        }

        $oldData = $user->toArray();

        $updateData = $request->only(['name', 'email', 'phone', 'status']);
        if ($roleIsActuallyChanging) {
            $updateData['role'] = $this->tierForRole($selectedRole);
        }
        $user->update($updateData);

        if ($roleIsActuallyChanging) {
            $this->syncSelectedRole($user, $selectedRole);
            // Their old session may still carry stale permissions (cached client-side from
            // login/me) — force an immediate re-login so the new role takes effect right away
            // instead of whenever their token would otherwise expire. (Never fires for a self-edit
            // — role changes to yourself are blocked above — so this can't log the actor out.)
            $user->tokens()->delete();
        }

        AuditLog::log($admin, 'update_user', 'User', $user->id, $oldData, $user->toArray(), 'User updated by admin');

        return $this->success(new UserResource($user), 'User updated');
    }

    /**
     * Reset a user's password (admin). Resetting a super_admin account's password requires
     * super_admin — any admin-tier account can reset a peer 'admin' account's password.
     */
    public function userResetPassword(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $admin = $request->user();
        $user = User::findOrFail($id);

        if ($user->role === 'super_admin' && !$admin->hasRole('super_admin')) {
            return $this->error('Only a super admin can reset a super admin account\'s password', 403);
        }

        $user->update(['password' => bcrypt($data['password'])]);

        AuditLog::log($admin, 'reset_user_password', 'User', $user->id, null, null, "Password reset for {$user->name} by admin");

        return $this->success(null, 'Password reset successfully');
    }

    /**
     * Delete user (admin) — soft delete, recoverable.
     */
    public function userDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $user = User::findOrFail($id);

        // Prevent admin from deleting self
        if ($user->id === $admin->id) {
            return $this->error('Cannot delete your own account', 400);
        }

        if ($user->role === 'super_admin' && !$admin->hasRole('super_admin')) {
            return $this->error('Only a super admin can delete a super admin account', 403);
        }

        AuditLog::log($admin, 'delete_user', 'User', $user->id, $user->toArray(), null, 'User soft-deleted by admin');

        $user->delete();

        return $this->success(null, 'User deleted');
    }

    /**
     * Permanently delete a user — super_admin only, irreversible.
     */
    public function userForceDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $user = User::withTrashed()->findOrFail($id);

        if ($user->id === $admin->id) {
            return $this->error('Cannot delete your own account', 400);
        }

        AuditLog::log($admin, 'force_delete_user', 'User', $user->id, $user->toArray(), null, 'User permanently deleted by super admin');

        $user->forceDelete();

        return $this->success(null, 'User permanently deleted');
    }

    /**
     * The 5 DB-level tiers — the only values the users.role enum column can actually hold.
     */
    private function tierRoleNames(): array
    {
        return ['customer', 'vendor', 'staff', 'admin', 'super_admin'];
    }

    /**
     * A custom role (anything created on the Roles page besides the 5 tiers) isn't a valid value
     * for the users.role enum column, so it's stored there as 'staff' — custom roles are always
     * staff-tier for admin-panel *access* purposes; the role name itself only drives *permissions*
     * via Spatie (see syncSelectedRole).
     */
    private function tierForRole(string $roleName): string
    {
        return in_array($roleName, $this->tierRoleNames(), true) ? $roleName : 'staff';
    }

    /**
     * Validation rule for the 'role' field: either one of the 5 tiers, or the name of an existing
     * custom role (created on the Roles page).
     */
    private function roleExistsRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if (in_array($value, $this->tierRoleNames(), true)) {
                return;
            }
            if (!\Spatie\Permission\Models\Role::where('name', $value)->exists()) {
                $fail('The selected role does not exist.');
            }
        };
    }

    /**
     * A user has exactly ONE role at a time — no "additional roles" on top. Whatever is selected
     * (a tier name like 'staff', or a custom role like 'Manager') becomes the user's sole Spatie
     * role, replacing anything they had before; that role's checked permissions are the only thing
     * that determines what they can do (see PermissionMiddleware / the sidebar's permission map).
     */
    private function syncSelectedRole(User $user, string $roleName): void
    {
        if (\Spatie\Permission\Models\Role::where('name', $roleName)->exists()) {
            $user->syncRoles([$roleName]);
        }
    }

    // ========== VENDOR MANAGEMENT ==========

    /**
     * List vendors for approval
     */
    public function vendors(Request $request): JsonResponse
    {
        $query = VendorProfile::with(['user', 'division', 'district', 'area']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('business_name', 'like', "%{$search}%")
                    ->orWhere('business_email', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $vendors = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($vendors);
    }

    /**
     * Get vendor details
     */
    public function vendorShow(int $id): JsonResponse
    {
        $vendor = VendorProfile::with([
            'user',
            'division',
            'district',
            'area',
            'services',
            'products',
            'serviceAreas',
        ])->findOrFail($id);

        // Get additional stats
        $orderStats = Order::where('vendor_profile_id', $id)
            ->selectRaw('
                COUNT(*) as total_orders,
                SUM(total) as total_revenue,
                SUM(CASE WHEN order_status = "completed" THEN 1 ELSE 0 END) as completed_orders
            ')
            ->first();

        return $this->success([
            'vendor' => new VendorProfileResource($vendor),
            'stats' => [
                'total_orders' => (int) $orderStats->total_orders,
                'completed_orders' => (int) $orderStats->completed_orders,
                'total_revenue' => (float) $orderStats->total_revenue ?? 0,
            ],
        ]);
    }

    /**
     * Approve vendor
     */
    public function vendorApprove(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $vendor = VendorProfile::with('user')->findOrFail($id);

        if ($vendor->status === 'approved') {
            return $this->error('Vendor is already approved', 400);
        }

        $vendor->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $admin->id,
        ]);

        AuditLog::log($admin, 'approve_vendor', 'VendorProfile', $vendor->id, null, [
            'status' => 'approved',
        ], 'Vendor approved');

        // Notify vendor
        if ($vendor->user) {
            Notification::notify(
                $vendor->user,
                'vendor_approved',
                'Vendor Application Approved',
                'Congratulations! Your vendor application has been approved. You can now start listing services and products.',
                ['vendor_id' => $vendor->id],
                '/vendor/dashboard'
            );
        }

        return $this->success(new VendorProfileResource($vendor->fresh()), 'Vendor approved');
    }

    /**
     * Reject vendor
     */
    public function vendorReject(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $admin = $request->user();
        $vendor = VendorProfile::with('user')->findOrFail($id);

        $vendor->update([
            'status' => 'rejected',
            'rejection_reason' => $request->reason,
        ]);

        AuditLog::log($admin, 'reject_vendor', 'VendorProfile', $vendor->id, null, [
            'status' => 'rejected',
            'reason' => $request->reason,
        ], 'Vendor rejected');

        // Notify vendor
        if ($vendor->user) {
            Notification::notify(
                $vendor->user,
                'vendor_rejected',
                'Vendor Application Rejected',
                "Your vendor application has been rejected. Reason: {$request->reason}",
                ['vendor_id' => $vendor->id, 'reason' => $request->reason],
                '/vendor/application'
            );
        }

        return $this->success(new VendorProfileResource($vendor->fresh()), 'Vendor rejected');
    }

    /**
     * Suspend vendor
     */
    public function vendorSuspend(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $admin = $request->user();
        $vendor = VendorProfile::with('user')->findOrFail($id);

        $vendor->update([
            'status' => 'suspended',
            'suspension_reason' => $request->reason,
        ]);

        AuditLog::log($admin, 'suspend_vendor', 'VendorProfile', $vendor->id, null, [
            'status' => 'suspended',
            'reason' => $request->reason,
        ], 'Vendor suspended');

        // Notify vendor
        if ($vendor->user) {
            Notification::notify(
                $vendor->user,
                'vendor_suspended',
                'Vendor Account Suspended',
                "Your vendor account has been suspended. Reason: {$request->reason}",
                ['vendor_id' => $vendor->id, 'reason' => $request->reason],
                '/vendor/dashboard'
            );
        }

        return $this->success(new VendorProfileResource($vendor->fresh()), 'Vendor suspended');
    }

    // ========== ORDER MANAGEMENT ==========

    /**
     * Create a manual/offline order (admin)
     */
    public function orderCreate(Request $request): JsonResponse
    {
        $request->validate([
            'customer_id'        => 'nullable|exists:users,id',
            'vendor_profile_id'  => 'nullable|exists:vendor_profiles,id',
            'customer_name'      => 'nullable|string|max:255',
            'customer_phone'     => 'nullable|string|max:20',
            'customer_email'     => 'nullable|email|max:255',
            'customer_address'   => 'nullable|string|max:500',
            'division_id'        => 'nullable|exists:divisions,id',
            'district_id'        => 'nullable|exists:districts,id',
            'area_id'            => 'nullable|exists:areas,id',
            'payment_method'     => 'required|string|max:50',
            'payment_status'     => 'required|in:pending,awaiting_confirmation,partially_paid,paid,failed',
            'paid_amount'        => 'required_if:payment_status,partially_paid|nullable|numeric|min:0.01',
            'order_status'       => 'required|in:pending,accepted,confirmed,in_progress,processing,awaiting_payment,completed',
            'discount'           => 'nullable|numeric|min:0',
            'shipping'           => 'nullable|numeric|min:0',
            'tax'                => 'nullable|numeric|min:0',
            'admin_notes'        => 'nullable|string|max:1000',
            'customer_notes'     => 'nullable|string|max:1000',
            'items'              => 'required|array|min:1',
            'items.*.item_type'  => 'required|in:product,service,custom',
            'items.*.product_id' => 'nullable|exists:products,id',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.item_name'  => 'required|string|max:255',
            'items.*.item_sku'   => 'nullable|string|max:100',
            'items.*.quantity'   => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.cost_price' => 'nullable|numeric|min:0',
            'items.*.warranty_value' => 'nullable|integer|min:0',
            'items.*.warranty_unit'  => 'nullable|in:day,week,month,year',
            'items.*.notes'      => 'nullable|string|max:500',
            // Which specific in-stock unit(s) of the product are being sold — optional, since
            // not every product is individually serialized.
            'items.*.serials'    => 'nullable|array',
            'items.*.serials.*'  => 'nullable|string|max:191',
        ]);

        $admin = $request->user();

        // If customer_id provided, fill missing fields from customer record
        $customerName  = $request->customer_name;
        $customerPhone = $request->customer_phone;
        $customerEmail = $request->customer_email;

        $customerId = $request->customer_id;

        if ($customerId) {
            $customer = User::find($customerId);
            if ($customer) {
                $customerName  = $customerName  ?? $customer->name;
                $customerPhone = $customerPhone ?? $customer->phone;
                $customerEmail = $customerEmail ?? $customer->email;
            }
        } else {
            // No existing customer linked — find-or-create one from the typed details, so this
            // customer shows up in the Customers page instead of only existing as free-text here.
            $customer = User::findOrCreateCustomer($customerName, $customerPhone, $customerEmail);
            $customerId = $customer?->id;
        }

        // Calculate totals
        $subtotal = 0;
        foreach ($request->items as $item) {
            $subtotal += $item['unit_price'] * $item['quantity'];
        }

        $discount = (float) ($request->discount ?? 0);
        $shipping = (float) ($request->shipping ?? 0);
        $tax      = (float) ($request->tax ?? 0);
        $total    = $subtotal - $discount + $shipping + $tax;

        DB::beginTransaction();
        try {
            $order = Order::create([
                'customer_id'       => $customerId,
                'vendor_profile_id' => $request->vendor_profile_id,
                'customer_name'     => $customerName,
                'customer_phone'    => $customerPhone,
                'customer_email'    => $customerEmail,
                'customer_address'  => $request->customer_address,
                'division_id'       => $request->division_id,
                'district_id'       => $request->district_id,
                'area_id'           => $request->area_id,
                'payment_method'    => $request->payment_method,
                'payment_status'    => $request->payment_status,
                'order_status'      => $request->order_status,
                'subtotal'          => $subtotal,
                'discount'          => $discount,
                'shipping'          => $shipping,
                'tax'               => $tax,
                'total'             => $total,
                'admin_notes'       => $request->admin_notes,
                'customer_notes'    => $request->customer_notes,
                'created_by'        => $admin->id,
            ]);

            // Set status timestamps
            $timestamps = [];
            if (in_array($request->order_status, ['accepted', 'confirmed', 'in_progress', 'processing', 'awaiting_payment', 'completed'])) {
                $timestamps['accepted_at'] = now();
            }
            if ($request->order_status === 'completed') {
                $timestamps['completed_at'] = now();
            }
            if ($timestamps) {
                $order->update($timestamps);
            }

            // Create order items
            foreach ($request->items as $item) {
                // 'custom' items are stored as item_type 'product' with no product_id
                $itemType = $item['item_type'] === 'custom' ? 'product' : $item['item_type'];

                $product = ($itemType === 'product' && !empty($item['product_id']))
                    ? Product::find($item['product_id'])
                    : null;

                $newItem = OrderItem::create([
                    'order_id'    => $order->id,
                    'item_type'   => $itemType,
                    'product_id'  => $item['product_id'] ?? null,
                    'service_id'  => $item['service_id'] ?? null,
                    'item_name'   => $item['item_name'],
                    'item_sku'    => $item['item_sku'] ?? null,
                    'quantity'    => $item['quantity'],
                    'unit_price'  => $item['unit_price'],
                    // Admin can override the cost per line in the order form; otherwise snapshot
                    // the product's current cost at the moment of sale so this order's margin
                    // stays accurate even if the product is repriced later.
                    'cost_price'  => $item['cost_price'] ?? $product?->current_cost ?? 0,
                    // The customer-facing warranty for this sale — defaults from the product's
                    // own warranty, but can be overridden per line (e.g. an extended-warranty
                    // upsell, or a display unit sold "as-is" with none).
                    'warranty_value' => $item['warranty_value'] ?? $product?->warranty_value,
                    'warranty_unit'  => $item['warranty_unit'] ?? $product?->warranty_unit,
                    'total_price' => $item['unit_price'] * $item['quantity'],
                    'notes'       => $item['notes'] ?? null,
                ]);

                // Sale reduces stock; cancel/refund restore it (see restockOrderItems), so this
                // side must actually run for that restock to mean anything instead of inflating
                // stock above reality. 'custom' charges have no product_id — nothing to decrement.
                if ($product) {
                    InventoryLog::logChange($product, 'sale', $item['quantity'], $order, 'Manual order created by admin', $admin);
                    $product->decrementStock($item['quantity']);

                    $this->attachSerialsToOrderItem($newItem, $item['product_id'], $item['serials'] ?? [], $admin->id);
                }
            }

            // Notify linked customer
            if ($request->customer_id) {
                $linkedCustomer = User::find($request->customer_id);
                if ($linkedCustomer) {
                    Notification::notify(
                        $linkedCustomer,
                        'manual_order_created',
                        'New Order Created',
                        "A new order #{$order->order_number} has been created for you by admin",
                        ['order_id' => $order->id],
                        "/orders/{$order->id}"
                    );
                }
            }

            if ($order->payment_status === 'paid') {
                $order->recordPayment($order->total, $admin);
            } elseif ($order->payment_status === 'partially_paid') {
                $order->recordPayment((float) $request->paid_amount, $admin);
            }

            AuditLog::log($admin, 'create_manual_order', 'Order', $order->id, null, $order->fresh()->toArray(), 'Manual order created by admin');

            DB::commit();

            $order->load(['customer', 'vendorProfile', 'items.product', 'items.service', 'division', 'district', 'area']);

            return $this->created(new OrderResource($order), 'Manual order created successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to create order: ' . $e->getMessage(), 500);
        }
    }

    /**
     * List all orders
     */
    public function orders(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'vendorProfile', 'items', 'creator:id,name']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('order_status', $request->status);
        }

        // Filter by payment status
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter by vendor
        if ($request->has('vendor_id')) {
            $query->where('vendor_profile_id', $request->vendor_id);
        }

        // Filter by customer
        if ($request->has('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        // Filter by whether a Purchase Order has been linked to source stock for this order
        if ($request->has('has_purchase_order')) {
            $query->{$request->boolean('has_purchase_order') ? 'whereHas' : 'whereDoesntHave'}('purchaseOrders');
        }

        // Date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Search
        if ($request->has('search')) {
            $query->where('order_number', 'like', "%{$request->search}%");
        }

        // ->through() so every row goes through OrderResource (is_guest, can_be_edited,
        // can_be_cancelled, etc.) instead of raw model attributes — orderShow() already does
        // this for the single-order view, but this list endpoint never did, so is_guest (and
        // everything else only OrderResource computes) was silently absent from every row here.
        $orders = $query->latest()
            ->paginate($request->get('per_page', 15))
            ->through(fn (Order $order) => new OrderResource($order));

        return $this->paginated($orders);
    }

    // ========== TICKET MANAGEMENT ==========

    /**
     * List all tickets
     */
    public function tickets(Request $request): JsonResponse
    {
        $query = Ticket::with(['user', 'vendorProfile', 'order'])
            ->withCount('messages');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by priority
        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        // Filter by assignment
        if ($request->has('assigned_to')) {
            $query->where('assigned_to', $request->assigned_to);
        }

        $tickets = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($tickets);
    }

    /**
     * Assign ticket
     */
    public function ticketAssign(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'assigned_to' => 'required|in:admin,vendor',
            'vendor_id' => 'required_if:assigned_to,vendor|nullable|exists:vendor_profiles,id',
        ]);

        $admin = $request->user();
        $ticket = Ticket::findOrFail($id);

        $updateData = ['assigned_to' => $request->assigned_to];

        if ($request->assigned_to === 'vendor' && $request->vendor_id) {
            $updateData['vendor_profile_id'] = $request->vendor_id;
        }

        $ticket->update($updateData);

        AuditLog::log($admin, 'assign_ticket', 'Ticket', $ticket->id, null, $updateData, 'Ticket assigned');

        return $this->success(new TicketResource($ticket->fresh()), 'Ticket assigned');
    }

    // ========== REVIEW MANAGEMENT ==========

    /**
     * List all reviews
     */
    public function reviews(Request $request): JsonResponse
    {
        $query = Review::with(['user', 'vendorProfile', 'order']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by rating
        if ($request->has('rating')) {
            $query->where('rating', $request->rating);
        }

        $reviews = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($reviews);
    }

    /**
     * Moderate review
     */
    public function reviewModerate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:approved,rejected,hidden',
            'reason' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();
        $review = Review::findOrFail($id);

        $review->update(['status' => $request->status]);

        AuditLog::log($admin, 'moderate_review', 'Review', $review->id, null, [
            'status' => $request->status,
            'reason' => $request->reason,
        ], 'Review moderated');

        return $this->success(new ReviewResource($review->fresh()), 'Review moderated');
    }

    /**
     * Delete review (admin)
     */
    public function reviewDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $review = Review::findOrFail($id);

        AuditLog::log($admin, 'delete_review', 'Review', $review->id, $review->toArray(), null, 'Review deleted by admin');

        $review->delete();

        return $this->success(null, 'Review deleted');
    }

    // ========== PAYMENTS MANAGEMENT ==========

    /**
     * List all payments (orders with payment focus)
     */
    public function payments(Request $request): JsonResponse
    {
        $query = Order::with(['customer', 'vendorProfile', 'items', 'creator:id,name']);

        // Filter by payment status
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter by payment method
        if ($request->has('payment_method')) {
            $query->where('payment_method', $request->payment_method);
        }

        // Filter by vendor
        if ($request->has('vendor_id')) {
            $query->where('vendor_profile_id', $request->vendor_id);
        }

        // Filter by customer
        if ($request->has('customer_id')) {
            $query->where('user_id', $request->customer_id);
        }

        // Date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Search by order number or reference
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('transaction_reference', 'like', "%{$search}%");
            });
        }

        $payments = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($payments);
    }

    /**
     * Update payment status
     */
    public function paymentUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,awaiting_confirmation,paid,verified,failed,refunded',
            'transaction_reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        $admin = $request->user();
        $order = Order::with('items.product')->findOrFail($id);

        $oldStatus = $order->payment_status;
        $wasPaidOrPartial = in_array($oldStatus, ['paid', 'partially_paid', 'verified'], true);

        $updateData = [];
        if ($request->has('transaction_reference')) {
            $updateData['transaction_reference'] = $request->transaction_reference;
        }

        // 'verified' means the same thing as 'paid' financially — an admin has confirmed the full
        // amount was received — so both must post the same AR/revenue ledger entries. They were
        // previously handled inconsistently: 'paid' recognized revenue, 'verified' silently didn't,
        // leaving verified orders with paid_amount=0 and no journal entries at all.
        if (in_array($request->status, ['paid', 'verified'], true) && !in_array($oldStatus, ['paid', 'verified'], true)) {
            if ($order->outstanding_receivable <= 0) {
                return $this->error('This order has nothing outstanding to mark as paid — the recorded payment amount may need correcting instead.', 422);
            }
            if ($updateData) {
                $order->update($updateData);
            }
            $order->recordPayment($order->outstanding_receivable, $admin);
            if ($request->status === 'verified') {
                // recordPayment() sets payment_status to 'paid'/'partially_paid' based on amount —
                // override back to 'verified' to preserve the distinct label after the ledger is posted.
                $order->update(['payment_status' => 'verified']);
            }
        } elseif ($request->status === 'refunded' && $wasPaidOrPartial) {
            $updateData['payment_status'] = 'refunded';
            $updateData['refund_amount'] = $order->paid_amount;
            // Keep order_status in sync too — otherwise an order can end up "Completed" and
            // "Refunded" at once, and previously nothing here restocked the returned products at
            // all (only the dedicated Refund action and cancelling did).
            if (!in_array($order->order_status, ['cancelled', 'refunded'], true)) {
                $updateData['order_status'] = 'refunded';
            }
            $order->update($updateData);
            JournalEntry::reverseAllFor('Order', $order->id, "Order #{$order->order_number} payment marked refunded by admin", $admin);
            $this->restockOrderItems($order, $admin, 'Order payment refunded by admin');
        } elseif ($wasPaidOrPartial && in_array($request->status, ['pending', 'awaiting_confirmation', 'failed'], true)) {
            // Revenue has already been recognized for this order — silently downgrading the status
            // label without reversing the ledger would leave the books saying "money received"
            // while the order displays as unpaid. Force the explicit refund path instead, which
            // correctly reverses the journal entries.
            return $this->error("This order is already {$oldStatus} and has revenue recognized in the ledger — use Refund instead of changing the status directly.", 422);
        } else {
            $updateData['payment_status'] = $request->status;
            $order->update($updateData);
        }

        AuditLog::log($admin, 'update_payment_status', 'Order', $order->id, [
            'payment_status' => $oldStatus,
        ], [
            'payment_status' => $order->fresh()->payment_status,
            'notes' => $request->notes,
        ], 'Payment status updated');

        return $this->success(new OrderResource($order->fresh(['customer', 'vendorProfile'])), 'Payment status updated');
    }

    // ========== PAYMENT NOTICES ==========

    /**
     * List all payment notices (admin)
     */
    public function paymentNotices(Request $request): JsonResponse
    {
        $query = PaymentNotice::with(['order.customer', 'order.vendorProfile']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by vendor
        if ($request->has('vendor_id')) {
            $query->whereHas('order', function ($q) use ($request) {
                $q->where('vendor_profile_id', $request->vendor_id);
            });
        }

        $notices = $query->latest()->paginate($request->get('per_page', 15));

        return $this->paginated($notices);
    }

    /**
     * Update payment notice status (admin)
     */
    public function paymentNoticeUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,verified,rejected',
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $admin = $request->user();
        $notice = PaymentNotice::with('order')->findOrFail($id);

        $oldStatus = $notice->status;
        $notice->update([
            'status' => $request->status,
            'admin_notes' => $request->admin_notes,
            'verified_at' => $request->status === 'verified' ? now() : null,
            'verified_by' => $request->status === 'verified' ? $admin->id : null,
        ]);

        // Verifying a payment notice records exactly the amount the customer reported paying —
        // it may only cover part of the order, so this can leave the order 'partially_paid'
        // rather than jumping straight to 'paid'.
        if ($request->status === 'verified' && $notice->order) {
            $amount = min((float) $notice->amount, $notice->order->outstanding_receivable);
            if ($amount > 0) {
                $notice->order->recordPayment($amount, $admin);
            }
        }

        AuditLog::log($admin, 'update_payment_notice', 'PaymentNotice', $notice->id, [
            'status' => $oldStatus,
        ], [
            'status' => $request->status,
            'admin_notes' => $request->admin_notes,
        ], 'Payment notice updated');

        return $this->success($notice->fresh(), 'Payment notice updated');
    }

    // ========== CMS PAGES ==========

    /**
     * List CMS pages
     */
    public function cmsPages(Request $request): JsonResponse
    {
        $query = CmsPage::query();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('page_type')) {
            $query->where('page_type', $request->page_type);
        }

        $pages = $query->orderBy('title')->paginate($request->get('per_page', 15));

        return $this->paginated($pages);
    }

    /**
     * Get CMS page
     */
    public function cmsPageShow(int $id): JsonResponse
    {
        $page = CmsPage::findOrFail($id);

        return $this->success(new CmsPageResource($page));
    }

    /**
     * Create CMS page
     */
    public function cmsPageStore(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:cms_pages,slug',
            'content' => 'required|string',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'status' => 'in:draft,published',
            'page_type' => 'nullable|in:page,faq,terms,privacy,about,contact,guide',
            'featured_image' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();
        $status = $request->status ?? 'draft';

        $page = CmsPage::create([
            'title' => $request->title,
            'slug' => $request->slug,
            'content' => $request->content,
            'meta_title' => $request->meta_title,
            'meta_description' => $request->meta_description,
            'status' => $status,
            'page_type' => $request->page_type ?? 'page',
            'featured_image' => $request->featured_image,
            'created_by' => $admin->id,
            // Never set otherwise (see cmsPageUpdate) — needed for /guides to sort and display
            // by publish date, and for a published page to have a real "published" timestamp.
            'published_at' => $status === 'published' ? now() : null,
        ]);

        AuditLog::log($admin, 'create_cms_page', 'CmsPage', $page->id, null, $page->toArray(), 'CMS page created');

        return $this->created(new CmsPageResource($page), 'CMS page created');
    }

    /**
     * Update CMS page
     */
    public function cmsPageUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'title' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:cms_pages,slug,' . $id,
            'content' => 'sometimes|string',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'status' => 'in:draft,published',
            'page_type' => 'nullable|in:page,faq,terms,privacy,about,contact,guide',
            'featured_image' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();
        $page = CmsPage::findOrFail($id);

        $oldData = $page->toArray();
        $data = $request->only([
            'title', 'slug', 'content', 'meta_title', 'meta_description', 'status', 'page_type', 'featured_image',
        ]);
        // First time this page goes live, stamp it — needed for /guides to sort and display by
        // publish date. Never overwritten on a later edit, so re-saving an already-published
        // page doesn't bump its date.
        if (($data['status'] ?? null) === 'published' && !$page->published_at) {
            $data['published_at'] = now();
        }
        $page->update($data);

        AuditLog::log($admin, 'update_cms_page', 'CmsPage', $page->id, $oldData, $page->toArray(), 'CMS page updated');

        return $this->success(new CmsPageResource($page->fresh()), 'CMS page updated');
    }

    /**
     * Delete CMS page
     */
    public function cmsPageDestroy(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $page = CmsPage::findOrFail($id);

        AuditLog::log($admin, 'delete_cms_page', 'CmsPage', $page->id, $page->toArray(), null, 'CMS page deleted');

        $page->delete();

        return $this->success(null, 'CMS page deleted');
    }

    // ========== BANNERS ==========

    /**
     * List banners
     */
    public function banners(Request $request): JsonResponse
    {
        $query = Banner::orderBy('sort_order');

        if ($request->has('position')) {
            $query->where('position', $request->position);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $paginator = $query->paginate($request->get('per_page', 15));

        // Transform through BannerResource so image returns full asset URL
        $paginator->through(fn($banner) => (new BannerResource($banner))->toArray($request));

        return $this->paginated($paginator);
    }

    /**
     * Create banner
     */
    public function bannerStore(Request $request): JsonResponse
    {
        // Image is optional for side banners (homepage_banner) which use icon+gradient
        $imageRule = $request->input('position') === 'homepage_banner'
            ? 'nullable|image|max:4096'
            : 'required|image|max:4096';

        $request->validate([
            'title' => 'required|string|max:255',
            'subtitle' => 'nullable|string|max:500',
            'image' => $imageRule,
            'link_url' => 'nullable|string|max:500',
            'link_text' => 'nullable|string|max:100',
            'position' => 'required|in:homepage_slider,homepage_banner,sidebar,category_page,popup',
            'sort_order' => 'nullable|integer',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
            'is_active' => 'boolean',
            'meta' => 'nullable|array',
        ]);

        $admin = $request->user();

        $imagePath = $request->hasFile('image')
            ? $request->file('image')->store('banners', 'public')
            : null;

        $banner = Banner::create([
            'title' => $request->title,
            'subtitle' => $request->subtitle,
            'image' => $imagePath,
            'link_url' => $request->link_url,
            'link_text' => $request->link_text,
            'position' => $request->position,
            'sort_order' => $request->sort_order ?? 0,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'is_active' => $request->boolean('is_active', true),
            'meta' => $request->meta,
        ]);

        AuditLog::log($admin, 'create_banner', 'Banner', $banner->id, null, $banner->toArray(), 'Banner created');

        return $this->created(new BannerResource($banner), 'Banner created');
    }

    /**
     * Update banner
     */
    public function bannerUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'title' => 'sometimes|string|max:255',
            'subtitle' => 'nullable|string|max:500',
            'image' => 'sometimes|image|max:4096',
            'link_url' => 'nullable|string|max:500',
            'link_text' => 'nullable|string|max:100',
            'position' => 'sometimes|in:homepage_slider,homepage_banner,sidebar,category_page,popup',
            'sort_order' => 'nullable|integer',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
            'is_active' => 'boolean',
            'meta' => 'nullable|array',
        ]);

        $admin = $request->user();
        $banner = Banner::findOrFail($id);

        $updateData = $request->only(['title', 'subtitle', 'link_url', 'link_text', 'position', 'sort_order', 'start_date', 'end_date', 'is_active', 'meta']);

        if ($request->hasFile('image')) {
            $updateData['image'] = $request->file('image')->store('banners', 'public');
        } elseif ($request->input('remove_image') == '1') {
            $updateData['image'] = null;
        }

        $oldData = $banner->toArray();
        $banner->update($updateData);

        AuditLog::log($admin, 'update_banner', 'Banner', $banner->id, $oldData, $updateData, 'Banner updated');

        return $this->success(new BannerResource($banner->fresh()), 'Banner updated');
    }

    /**
     * Delete banner
     */
    public function bannerDestroy(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $banner = Banner::findOrFail($id);

        AuditLog::log($admin, 'delete_banner', 'Banner', $banner->id, $banner->toArray(), null, 'Banner deleted');

        $banner->delete();

        return $this->success(null, 'Banner deleted');
    }

    // ========== FAQs ==========

    /**
     * List FAQs
     */
    public function faqs(Request $request): JsonResponse
    {
        $query = Faq::orderBy('category')->orderBy('sort_order');

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $faqs = $query->paginate($request->get('per_page', 20));

        return $this->paginated($faqs);
    }

    /**
     * Create FAQ
     */
    public function faqStore(Request $request): JsonResponse
    {
        $request->validate([
            'question' => 'required|string|max:500',
            'answer' => 'required|string',
            'category' => 'required|string|max:100',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        $admin = $request->user();

        $faq = Faq::create([
            'question' => $request->question,
            'answer' => $request->answer,
            'category' => $request->category,
            'sort_order' => $request->sort_order ?? 0,
            'is_active' => $request->is_active ?? true,
        ]);

        AuditLog::log($admin, 'create_faq', 'Faq', $faq->id, null, $faq->toArray(), 'FAQ created');

        return $this->created(new FaqResource($faq), 'FAQ created');
    }

    /**
     * Update FAQ
     */
    public function faqUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'question' => 'sometimes|string|max:500',
            'answer' => 'sometimes|string',
            'category' => 'sometimes|string|max:100',
            'sort_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        $admin = $request->user();
        $faq = Faq::findOrFail($id);

        $oldData = $faq->toArray();
        $faq->update($request->only(['question', 'answer', 'category', 'sort_order', 'is_active']));

        AuditLog::log($admin, 'update_faq', 'Faq', $faq->id, $oldData, $faq->toArray(), 'FAQ updated');

        return $this->success(new FaqResource($faq->fresh()), 'FAQ updated');
    }

    /**
     * Delete FAQ
     */
    public function faqDestroy(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $faq = Faq::findOrFail($id);

        AuditLog::log($admin, 'delete_faq', 'Faq', $faq->id, $faq->toArray(), null, 'FAQ deleted');

        $faq->delete();

        return $this->success(null, 'FAQ deleted');
    }

    // ========== SITE SETTINGS ==========

    /**
     * Get all site settings
     */
    public function settings(Request $request): JsonResponse
    {
        $query = SiteSetting::query();

        if ($request->has('group')) {
            $query->where('group', $request->group);
        }

        $settings = $query->orderBy('group')->orderBy('key')->get();

        // Transform to key-value format grouped by group
        $grouped = $settings->groupBy('group')->map(function ($items) {
            return $items->pluck('value', 'key');
        });

        return $this->success($grouped);
    }

    /**
     * Update site settings
     */
    public function settingsUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string|max:100',
            'settings.*.value' => 'nullable|string',
            'settings.*.group' => 'nullable|string|max:50',
            'settings.*.type' => 'nullable|string|max:20',
        ]);

        $admin = $request->user();

        // Keys that should always be stored as JSON/array type
        $jsonKeys = ['news_ticker_items', 'homepage_service_cards', 'cta_trust_indicators', 'footer_nav_links'];

        foreach ($request->settings as $setting) {
            $existing = SiteSetting::where('key', $setting['key'])->first();
            $updateData = ['value' => $setting['value'] ?? ''];
            // Preserve existing group; only override if explicitly provided
            if (!empty($setting['group'])) {
                $updateData['group'] = $setting['group'];
            } elseif (!$existing) {
                $updateData['group'] = 'general';
            }
            // Set type for new records: use provided type, or detect JSON keys, else default to text
            if (!$existing) {
                if (!empty($setting['type'])) {
                    $updateData['type'] = $setting['type'];
                } elseif (in_array($setting['key'], $jsonKeys)) {
                    $updateData['type'] = 'json';
                }
            } elseif (!empty($setting['type'])) {
                $updateData['type'] = $setting['type'];
            }
            SiteSetting::updateOrCreate(['key' => $setting['key']], $updateData);
        }

        AuditLog::log($admin, 'update_settings', 'SiteSetting', null, null, $request->settings, 'Site settings updated');

        return $this->success(null, 'Settings updated');
    }

    // ========== AUDIT LOGS ==========

    /**
     * List audit logs
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $query = AuditLog::with('actor');

        // Filter by actor (user)
        if ($request->has('user_id')) {
            $query->where('actor_id', $request->user_id);
        }

        // Filter by action type
        if ($request->has('action') || $request->has('action_type')) {
            $query->where('action_type', $request->action ?? $request->action_type);
        }

        // Filter by resource type (model type)
        if ($request->has('model_type') || $request->has('resource_type')) {
            $query->where('resource_type', $request->model_type ?? $request->resource_type);
        }

        // Filter by resource ID
        if ($request->has('resource_id')) {
            $query->where('resource_id', $request->resource_id);
        }

        // Date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $logs = $query->latest()->paginate($request->get('per_page', 20));

        return $this->paginated($logs);
    }

    // ========== ENHANCED ORDER MANAGEMENT ==========

    /**
     * Get single order detail (admin)
     */
    public function orderShow(int $id): JsonResponse
    {
        $order = Order::with([
            'customer',
            'vendorProfile',
            'items.product',
            'items.service',
            'items.costs',
            'items.serials',
            'paymentNotices',
            'review',
            'division',
            'district',
            'area',
            'tickets',
            'serviceIntake.items',
            'creator:id,name',
            'purchaseOrders.items:id,purchase_order_id,product_id',
        ])->findOrFail($id);

        return $this->success(new OrderResource($order));
    }

    /**
     * Update an order's customer info, items, and pricing (admin). Allowed any time before the
     * order is completed/cancelled/refunded. Once a payment has been recorded against the order,
     * items/pricing are locked (see Order::canEditItemsAndPricing()) since the AR/revenue journal
     * entries were already posted against the order's current total — changing it afterwards would
     * desync the ledger. Order/payment status changes go through their own dedicated endpoints.
     */
    public function orderUpdate(Request $request, int $id): JsonResponse
    {
        $order = Order::with('items')->findOrFail($id);
        $admin = $request->user();

        // Items/pricing are normally locked once revenue has been recognized (a payment was
        // recorded) — but a super_admin (or anyone specifically granted amend_paid_orders) can
        // still amend a paid order, including one that's already `completed` (wrong quantity,
        // wrong product, a price correction found after the fact). Mutually exclusive with
        // $normalItemEdit below: one requires revenue not yet recognized, the other requires it
        // recognized.
        $superAdminAmend = $order->requiresSuperAdminToAmend() && ($admin->hasRole('super_admin') || $admin->can('amend_paid_orders'));

        if (!$order->canBeEdited() && !$superAdminAmend) {
            return $this->error('This order can no longer be edited because it is ' . str_replace('_', ' ', $order->order_status) . '.', 422);
        }

        // Captured before any mutation below, purely for the audit trail — lets the "View History"
        // panel show a real before/after diff instead of the null old-values it used to record.
        $oldSnapshot = $order->toArray();
        $oldSnapshot['items'] = $order->items->toArray();

        $normalItemEdit = $order->canEditItemsAndPricing();
        $editItemsAndPricing = $normalItemEdit || $superAdminAmend;

        $rules = [
            'customer_name'      => 'nullable|string|max:255',
            'customer_phone'     => 'nullable|string|max:20',
            'customer_email'     => 'nullable|email|max:255',
            'customer_address'   => 'nullable|string|max:500',
            'division_id'        => 'nullable|exists:divisions,id',
            'district_id'        => 'nullable|exists:districts,id',
            'area_id'            => 'nullable|exists:areas,id',
            'payment_method'     => 'nullable|string|max:50',
            'admin_notes'        => 'nullable|string|max:1000',
            'customer_notes'     => 'nullable|string|max:1000',
        ];

        if ($editItemsAndPricing) {
            $rules += [
                'discount'           => 'nullable|numeric|min:0',
                'shipping'           => 'nullable|numeric|min:0',
                'tax'                => 'nullable|numeric|min:0',
                'items'              => 'required|array|min:1',
                'items.*.item_type'  => 'required|in:product,service,custom',
                'items.*.product_id' => 'nullable|exists:products,id',
                'items.*.service_id' => 'nullable|exists:services,id',
                'items.*.item_name'  => 'required|string|max:255',
                'items.*.item_sku'   => 'nullable|string|max:100',
                'items.*.quantity'   => 'required|integer|min:1',
                'items.*.unit_price' => 'required|numeric|min:0',
                'items.*.cost_price' => 'nullable|numeric|min:0',
                'items.*.warranty_value' => 'nullable|integer|min:0',
                'items.*.warranty_unit'  => 'nullable|in:day,week,month,year',
                'items.*.notes'      => 'nullable|string|max:500',
                'items.*.serials'    => 'nullable|array',
                'items.*.serials.*'  => 'nullable|string|max:191',
            ];
        }

        $data = $request->validate($rules);

        DB::beginTransaction();
        try {
            $updateData = array_intersect_key($data, array_flip([
                'customer_name', 'customer_phone', 'customer_email', 'customer_address',
                'division_id', 'district_id', 'area_id', 'payment_method', 'admin_notes', 'customer_notes',
            ]));

            if ($editItemsAndPricing) {
                $subtotal = 0;
                foreach ($data['items'] as $item) {
                    $subtotal += $item['unit_price'] * $item['quantity'];
                }
                $discount = (float) ($data['discount'] ?? 0);
                $shipping = (float) ($data['shipping'] ?? 0);
                $tax      = (float) ($data['tax'] ?? 0);

                $updateData['subtotal'] = $subtotal;
                $updateData['discount'] = $discount;
                $updateData['shipping'] = $shipping;
                $updateData['tax']      = $tax;
                $updateData['total']    = $subtotal - $discount + $shipping + $tax;
            }

            $order->update($updateData);

            if ($editItemsAndPricing) {
                if ($superAdminAmend) {
                    // This order was already paid — the sale/COGS recognition entries posted at
                    // the OLD total must be undone before the new total is recognized below. Only
                    // the entries anchored on Revenue (4000) / COGS (5000) are touched; the
                    // cash-received entries (1000/1010) are left alone since that money was
                    // actually collected and isn't undone by the items/amount changing.
                    JournalEntry::reverseForAccounts('Order', $order->id, ['4000', '5000'],
                        "Order #{$order->order_number} amended by super admin — reversing prior revenue/COGS recognition", $admin);
                }

                // The incoming item list has no stable ID to match against (the edit form only
                // ever sends type/product/service/name/qty/price/notes) — so before the whole
                // set gets deleted and recreated below, match old items to their replacements by
                // (type, product/service, name) — the identity of a line item, as opposed to its
                // quantity/price/notes, which are exactly what an edit is expected to change — and
                // carry any linked costs over to the new row. Otherwise a cost added before the
                // order's first payment (routine — buying a part or outsourcing before the
                // customer has paid) would silently detach the moment the order is next edited.
                // Capture each old item's linked expense IDs now — not the OrderItem itself.
                // The FK's nullOnDelete fires the instant items()->delete() runs below, so by
                // the time this loop reaches the relink step, expenses.order_item_id has already
                // been nulled out at the DB level; matching on expense id (which the delete never
                // touches) instead of the now-stale order_item_id is what makes the relink work.
                $oldItemsByKey = [];
                foreach ($order->items()->has('costs')->with('costs')->get() as $oldItem) {
                    $key = $oldItem->item_type . '|' . $oldItem->product_id . '|' . $oldItem->service_id . '|' . $oldItem->item_name;
                    $oldItemsByKey[$key][] = $oldItem->costs->pluck('id')->all();
                }

                // Restore stock for every old product line before it's deleted — the whole set
                // gets recreated below with no stable ID to diff against, so "adjust by the
                // delta" isn't available; restoring everything then decrementing the new set
                // nets out to the same result (quantity changed, product swapped, item removed
                // all fall out correctly) without needing to match old-to-new items at all.
                foreach ($order->items as $oldItem) {
                    if ($oldItem->item_type === 'product' && $oldItem->product) {
                        InventoryLog::logChange($oldItem->product, 'return', $oldItem->quantity, $order, 'Order edited by admin — item replaced', $admin);
                        $oldItem->product->incrementStock($oldItem->quantity);
                        $this->releaseSerialsForOrderItem($oldItem);
                    }
                }

                $order->items()->delete();
                foreach ($data['items'] as $item) {
                    $itemType = $item['item_type'] === 'custom' ? 'product' : $item['item_type'];
                    $product = ($itemType === 'product' && !empty($item['product_id']))
                        ? Product::find($item['product_id'])
                        : null;

                    $newItem = OrderItem::create([
                        'order_id'    => $order->id,
                        'item_type'   => $itemType,
                        'product_id'  => $item['product_id'] ?? null,
                        'service_id'  => $item['service_id'] ?? null,
                        'item_name'   => $item['item_name'],
                        'item_sku'    => $item['item_sku'] ?? null,
                        'quantity'    => $item['quantity'],
                        'unit_price'  => $item['unit_price'],
                        'cost_price'  => $item['cost_price'] ?? $product?->current_cost ?? 0,
                        'warranty_value' => $item['warranty_value'] ?? $product?->warranty_value,
                        'warranty_unit'  => $item['warranty_unit'] ?? $product?->warranty_unit,
                        'total_price' => $item['unit_price'] * $item['quantity'],
                        'notes'       => $item['notes'] ?? null,
                    ]);

                    if ($product) {
                        InventoryLog::logChange($product, 'sale', $item['quantity'], $order, 'Order edited by admin', $admin);
                        $product->decrementStock($item['quantity']);
                        $this->attachSerialsToOrderItem($newItem, $item['product_id'], $item['serials'] ?? [], $admin->id);
                    }

                    $key = $itemType . '|' . ($item['product_id'] ?? null) . '|' . ($item['service_id'] ?? null) . '|' . $item['item_name'];
                    if (!empty($oldItemsByKey[$key])) {
                        $expenseIds = array_shift($oldItemsByKey[$key]);
                        Expense::whereIn('id', $expenseIds)->update(['order_item_id' => $newItem->id]);
                    }
                }

                if ($superAdminAmend) {
                    // $order->items was eager-loaded before this method touched anything, and
                    // neither items()->delete() nor the bare OrderItem::create() calls above
                    // refresh that in-memory collection — without unsetting it here,
                    // recognizeRevenueAndCogs()'s loadMissing('items.product') would silently see
                    // the stale (deleted) old items instead of the new ones and compute COGS wrong.
                    $order->unsetRelation('items');

                    // Mirrors the exact ternary recordPayment() uses when paid_amount changes —
                    // here it's $order->total that changed instead, so payment_status needs the
                    // same recompute against the (untouched) amount actually collected.
                    $order->payment_status = $order->paid_amount >= $order->total ? 'paid' : 'partially_paid';
                    $order->save();

                    $order->recognizeRevenueAndCogs($admin);
                }
            }

            AuditLog::log($admin, 'update_order', 'Order', $order->id, $oldSnapshot, $order->fresh(['items'])->toArray(), 'Order edited by admin');

            DB::commit();

            $order->load(['customer', 'vendorProfile', 'items.product', 'items.service', 'division', 'district', 'area']);

            return $this->success(new OrderResource($order), 'Order updated successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to update order: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Restock every product line item on an order — shared by every code path that can end an
     * order in 'cancelled' or 'refunded' (status change, payment refund, dedicated refund), so
     * inventory is never silently left un-returned no matter which action an admin used.
     */
    private function restockOrderItems(Order $order, User $admin, string $reasonNote): void
    {
        foreach ($order->items as $item) {
            if ($item->item_type === 'product' && $item->product) {
                InventoryLog::logChange(
                    $item->product,
                    'return',
                    $item->quantity,
                    $order,
                    $reasonNote,
                    $admin
                );
                $item->product->incrementStock($item->quantity);
                $this->releaseSerialsForOrderItem($item);
            }
        }
    }

    /**
     * Mark the given serial numbers of a product as sold under this order item. A serial that
     * doesn't exist yet for this product is recorded now rather than rejected — product_serials
     * is an identity layer on top of stock_qty (the real source of truth for available quantity),
     * not a gate on it, so this covers legacy stock or any unit whose serial was never captured
     * at receiving time. Throws only when the serial exists but is already sold/otherwise
     * unavailable — caught by the calling method's transaction, which rolls back cleanly rather
     * than leaving the order half-created.
     */
    private function attachSerialsToOrderItem(OrderItem $item, int $productId, array $serials, ?int $addedBy = null): void
    {
        $serials = array_values(array_filter(array_map('trim', $serials)));

        if (empty($serials)) {
            // No serials were explicitly named for this line. Leaving it at that silently means
            // every serial for this product keeps claiming to be `in_stock` even though the
            // caller has already decremented the product's *aggregate* stock count for this sale
            // — the two drift out of sync, and (worse) a since-sold unit can still pass every
            // "is this available to return to the supplier" check on the purchase-order side,
            // since that only ever looks at per-serial status. Confirmed in production: a manual
            // order sold a serialized product with no serial picked, and the untouched serial
            // was later returned to the supplier while still legitimately out with that customer.
            // Best-effort auto-pick the oldest in-stock serial(s) instead — same fallback
            // PurchaseOrderController::returnToSupplier() already uses when nothing specific was
            // named. A shortfall isn't an error here: some stock legitimately predates serial
            // tracking (backfilled manually), so this product may not be fully serialized.
            $available = ProductSerial::where('product_id', $productId)->where('status', 'in_stock')
                ->oldest('id')->take($item->quantity)->get();
            foreach ($available as $record) {
                $record->update(['status' => 'sold', 'order_item_id' => $item->id]);
            }
            return;
        }

        foreach ($serials as $serial) {
            $record = ProductSerial::where('product_id', $productId)->where('serial_number', $serial)->first();

            if ($record && $record->status !== 'in_stock') {
                throw new \RuntimeException("Serial number \"{$serial}\" has already been sold and can't be used again.");
            }

            if ($record) {
                $record->update(['status' => 'sold', 'order_item_id' => $item->id]);
            } else {
                ProductSerial::create([
                    'product_id' => $productId,
                    'serial_number' => $serial,
                    'status' => 'sold',
                    'order_item_id' => $item->id,
                    'added_by' => $addedBy,
                ]);
            }
        }
    }

    /** Reverts every serial sold under this order item back to in-stock — the inverse of attachSerialsToOrderItem(). */
    private function releaseSerialsForOrderItem(OrderItem $item): void
    {
        ProductSerial::where('order_item_id', $item->id)->update(['status' => 'in_stock', 'order_item_id' => null]);
    }

    /**
     * Update order status (admin)
     */
    public function orderUpdateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'order_status' => 'required|in:pending,accepted,rejected,confirmed,in_progress,processing,awaiting_payment,completed,cancelled,refunded',
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $admin = $request->user();
        $order = Order::with(['customer', 'vendorProfile'])->findOrFail($id);

        $oldStatus = $order->order_status;
        $newStatus = $request->order_status;

        $updateData = ['order_status' => $newStatus];

        if ($request->admin_notes) {
            $updateData['admin_notes'] = $request->admin_notes;
        }

        // Set timestamps based on status
        switch ($newStatus) {
            case 'accepted':
                $updateData['accepted_at'] = now();
                break;
            case 'completed':
                $updateData['completed_at'] = now();
                break;
            case 'cancelled':
                $updateData['cancelled_at'] = now();
                break;
        }

        // This generic status-change endpoint can move an order straight to 'cancelled' or
        // 'refunded' — if any payment had already been recognized (paid or partially paid), that
        // revenue (and every partial payment posted against it) must be reversed here too, exactly
        // like the dedicated orderRefund() endpoint, otherwise cancelling/refunding an order via
        // this path leaves revenue permanently recognized in the ledger for money no longer kept.
        $wasPaidOrPartial = in_array($order->payment_status, ['paid', 'partially_paid', 'verified'], true);
        $shouldReverseRevenue = in_array($newStatus, ['cancelled', 'refunded'], true) && $oldStatus !== $newStatus && $wasPaidOrPartial;
        if ($shouldReverseRevenue) {
            $updateData['payment_status'] = 'refunded';
            $updateData['refund_amount'] = $order->paid_amount;
        }

        $order->update($updateData);

        if ($shouldReverseRevenue) {
            JournalEntry::reverseAllFor('Order', $order->id, "Order #{$order->order_number} marked {$newStatus} by admin", $admin);
        }

        // If cancelled or refunded, restore stock for product items — a refund via this generic
        // status endpoint is just as much a physical return as cancelling is, and previously only
        // 'cancelled' restocked, silently leaving refunded orders' stock un-returned.
        if (in_array($newStatus, ['cancelled', 'refunded'], true) && $oldStatus !== $newStatus) {
            $this->restockOrderItems($order, $admin, "Order marked {$newStatus} by admin");
        }

        AuditLog::log($admin, 'update_order_status', 'Order', $order->id, [
            'order_status' => $oldStatus,
        ], [
            'order_status' => $newStatus,
            'admin_notes' => $request->admin_notes,
        ], "Order status changed from {$oldStatus} to {$newStatus}");

        // Notify customer
        if ($order->customer) {
            Notification::notify(
                $order->customer,
                'order_status_changed',
                'Order Status Updated',
                "Your order #{$order->order_number} status has been updated to {$newStatus}",
                ['order_id' => $order->id, 'status' => $newStatus],
                "/orders/{$order->id}"
            );
        }
        // SMS for a status change is sent manually — see orderSendStatusSms() — not
        // automatically here, same reasoning as delivery/due SMS: the admin decides whether and
        // when the customer should be texted about it, not every status click.

        // Notify vendor
        if ($order->vendorProfile && $order->vendorProfile->user) {
            Notification::notify(
                $order->vendorProfile->user,
                'order_status_changed',
                'Order Status Updated by Admin',
                "Order #{$order->order_number} status has been updated to {$newStatus} by admin",
                ['order_id' => $order->id, 'status' => $newStatus],
                "/vendor/orders/{$order->id}"
            );
        }

        return $this->success(new OrderResource($order->fresh()), 'Order status updated');
    }

    /**
     * Manually notify the customer their order has been delivered. Deliberately a standalone
     * button rather than tied to any order_status transition — there's no 'delivered' status in
     * this system, and delivery is a real-world event only the admin actually knows happened.
     */
    public function orderSendDeliveredSms(Request $request, int $id, \App\Services\SmsService $sms): JsonResponse
    {
        $order = Order::findOrFail($id);
        $admin = $request->user();

        if (!$order->customer_phone) {
            return $this->error('This order has no customer phone number to send to.', 422);
        }

        if (!$sms->shouldSendOrderUpdates()) {
            return $this->error('Order SMS is currently disabled — enable it under SMS Center > Order & Billing.', 422);
        }

        $ok = $sms->sendOrderDelivered($order->customer_phone, $order->order_number, $order->id);

        if (!$ok) {
            return $this->error('Failed to send the delivery SMS. Check the SMS log for details.', 422);
        }

        AuditLog::log($admin, 'send_order_delivered_sms', 'Order', $order->id, null, [
            'phone' => $order->customer_phone,
        ], "Delivery SMS sent for order #{$order->order_number}");

        return $this->success(null, 'Delivery SMS sent.');
    }

    /**
     * Manually notify the customer about the order's current status. Not tied to the status
     * update itself — an admin can change status several times before deciding it's worth
     * texting about, or never at all.
     */
    public function orderSendStatusSms(Request $request, int $id, \App\Services\SmsService $sms): JsonResponse
    {
        $order = Order::findOrFail($id);
        $admin = $request->user();

        if (!$order->customer_phone) {
            return $this->error('This order has no customer phone number to send to.', 422);
        }

        if (!$sms->shouldSendOrderUpdates()) {
            return $this->error('Order SMS is currently disabled — enable it under SMS Center > Order & Billing.', 422);
        }

        $ok = $sms->sendOrderStatusChanged($order->customer_phone, $order->order_number, $order->order_status, $order->id);

        if (!$ok) {
            return $this->error('Failed to send the status SMS. Check the SMS log for details.', 422);
        }

        AuditLog::log($admin, 'send_order_status_sms', 'Order', $order->id, null, [
            'phone' => $order->customer_phone, 'status' => $order->order_status,
        ], "Status SMS sent for order #{$order->order_number}");

        return $this->success(null, 'Status SMS sent.');
    }

    /** Manually remind the customer about an outstanding balance on this order. */
    public function orderSendDueSms(Request $request, int $id, \App\Services\SmsService $sms): JsonResponse
    {
        $order = Order::findOrFail($id);
        $admin = $request->user();

        if (!$order->customer_phone) {
            return $this->error('This order has no customer phone number to send to.', 422);
        }

        if ($order->outstanding_receivable <= 0) {
            return $this->error('This order has no outstanding balance.', 422);
        }

        if (!$sms->shouldSendOrderUpdates()) {
            return $this->error('Order SMS is currently disabled — enable it under SMS Center > Order & Billing.', 422);
        }

        $ok = $sms->sendPaymentDueReminder($order->customer_phone, $order->order_number, number_format($order->outstanding_receivable, 2), $order->id);

        if (!$ok) {
            return $this->error('Failed to send the due SMS. Check the SMS log for details.', 422);
        }

        AuditLog::log($admin, 'send_order_due_sms', 'Order', $order->id, null, [
            'phone' => $order->customer_phone, 'amount_due' => $order->outstanding_receivable,
        ], "Due SMS sent for order #{$order->order_number}");

        return $this->success(null, 'Due SMS sent.');
    }

    /**
     * Renders the exact text one of the manual order SMS buttons would send, without sending it
     * — powers the confirmation modal's preview so an admin can see what a customer will receive
     * before committing to it. Reuses the same SmsService build*Message() helpers the real send
     * calls, so the preview can never drift from what actually goes out.
     */
    public function orderPreviewSms(Request $request, int $id, \App\Services\SmsService $sms): JsonResponse
    {
        $request->validate(['type' => 'required|in:status,delivered,due']);

        $order = Order::findOrFail($id);

        if (!$order->customer_phone) {
            return $this->error('This order has no customer phone number to send to.', 422);
        }

        $message = match ($request->type) {
            'status'    => $sms->buildOrderStatusMessage($order->order_number, $order->order_status),
            'delivered' => $sms->buildOrderDeliveredMessage($order->order_number),
            'due'       => $sms->buildPaymentDueMessage($order->order_number, number_format($order->outstanding_receivable, 2)),
        };

        return $this->success(['phone' => $order->customer_phone, 'message' => $message]);
    }

    /**
     * Process order refund (admin)
     */
    public function orderRefund(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'refund_amount' => 'nullable|numeric|min:0',
            'reason' => 'required|string|max:500',
        ]);

        $admin = $request->user();
        $order = Order::with(['customer', 'vendorProfile', 'items'])->findOrFail($id);

        if ($order->order_status === 'refunded') {
            return $this->error('Order is already refunded', 400);
        }

        if (!in_array($order->order_status, ['completed', 'accepted', 'in_progress', 'awaiting_payment'])) {
            return $this->error('This order cannot be refunded', 400);
        }

        // Can only ever refund what the customer actually paid — not the full order total if
        // it was only partially paid.
        $refundAmount = min($request->refund_amount ?? $order->paid_amount, $order->paid_amount);

        $oldStatus = $order->order_status;

        $order->update([
            'order_status' => 'refunded',
            'payment_status' => 'refunded',
            'refund_amount' => $refundAmount,
            'admin_notes' => ($order->admin_notes ? $order->admin_notes . "\n\n" : '') .
                "Refund processed by admin on " . now()->format('Y-m-d H:i:s') .
                "\nAmount: ৳{$refundAmount}" .
                "\nReason: {$request->reason}",
        ]);

        JournalEntry::reverseAllFor('Order', $order->id, "Refund for order #{$order->order_number}: {$request->reason}", $admin);

        $this->restockOrderItems($order, $admin, 'Order refunded by admin');

        AuditLog::log($admin, 'refund_order', 'Order', $order->id, [
            'order_status' => $oldStatus,
            'payment_status' => $order->getOriginal('payment_status'),
        ], [
            'order_status' => 'refunded',
            'payment_status' => 'refunded',
            'refund_amount' => $refundAmount,
            'reason' => $request->reason,
        ], "Order refunded: ৳{$refundAmount}");

        // Notify customer
        if ($order->customer) {
            Notification::notify(
                $order->customer,
                'order_refunded',
                'Order Refunded',
                "Your order #{$order->order_number} has been refunded. Amount: ৳{$refundAmount}",
                ['order_id' => $order->id, 'refund_amount' => $refundAmount],
                "/orders/{$order->id}"
            );
        }

        return $this->success(new OrderResource($order->fresh()), 'Order refunded successfully');
    }

    /**
     * Record a payment against an order — full or partial. Body: { amount }
     */
    public function orderRecordPayment(Request $request, int $id): JsonResponse
    {
        $order = Order::with(['customer', 'vendorProfile'])->findOrFail($id);

        if ($order->outstanding_receivable <= 0) {
            return $this->error('This order has nothing outstanding to pay', 422);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:' . $order->outstanding_receivable,
        ]);

        $admin = $request->user();

        try {
            $order->recordPayment((float) $data['amount'], $admin);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        AuditLog::log($admin, 'record_order_payment', 'Order', $order->id, null, ['amount' => $data['amount']], "Payment of ৳{$data['amount']} recorded for order #{$order->order_number}");

        return $this->success(new OrderResource($order->fresh(['customer', 'vendorProfile'])), 'Payment recorded successfully');
    }

    /**
     * Correct a mis-recorded payment amount for an order (e.g. staff typed ৳12,000 for a ৳6,000
     * cash payment) — distinct from amending the order's items/total, which corrects what was
     * CHARGED, not what was PAID. Super_admin (or anyone specifically granted
     * correct_payment_amounts), same trust boundary as order amendment.
     */
    public function orderCorrectPayment(Request $request, int $id): JsonResponse
    {
        $order = Order::with(['customer', 'vendorProfile'])->findOrFail($id);
        $admin = $request->user();

        if (!$admin->hasRole('super_admin') && !$admin->can('correct_payment_amounts')) {
            return $this->error('Only a super admin can correct a recorded payment amount.', 403);
        }
        if (!$order->requiresSuperAdminToAmend()) {
            return $this->error('This order has no recorded payment that can be corrected.', 422);
        }

        $data = $request->validate([
            'corrected_paid_amount' => 'required|numeric|min:0',
            'reason' => 'required|string|max:500',
        ]);

        $oldPaidAmount = (float) $order->paid_amount;

        try {
            $order->correctPaidAmount((float) $data['corrected_paid_amount'], $admin, $data['reason']);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }

        AuditLog::log($admin, 'correct_payment_amount', 'Order', $order->id,
            ['paid_amount' => $oldPaidAmount],
            ['paid_amount' => $order->paid_amount, 'reason' => $data['reason']],
            "Payment amount corrected for order #{$order->order_number}: {$data['reason']}");

        return $this->success(new OrderResource($order->fresh(['customer', 'vendorProfile'])), 'Payment amount corrected');
    }

    /**
     * Export orders as CSV
     */
    public function orderExport(Request $request)
    {
        $query = Order::with(['customer', 'vendorProfile', 'items']);

        // Apply same filters as order listing
        if ($request->has('status')) {
            $query->where('order_status', $request->status);
        }
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }
        if ($request->has('vendor_id')) {
            $query->where('vendor_profile_id', $request->vendor_id);
        }
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        if ($request->has('search')) {
            $query->where('order_number', 'like', "%{$request->search}%");
        }

        $orders = $query->latest()->get();

        $csvData = [];
        $csvData[] = ['Order #', 'Date', 'Customer', 'Customer Phone', 'Vendor', 'Status', 'Payment Status', 'Payment Method', 'Subtotal', 'Tax', 'Shipping', 'Discount', 'Total'];

        foreach ($orders as $order) {
            $csvData[] = [
                $order->order_number,
                $order->created_at->format('Y-m-d H:i'),
                $order->customer?->name ?? $order->customer_name,
                $order->customer_phone,
                $order->vendorProfile?->business_name ?? 'N/A',
                $order->order_status,
                $order->payment_status,
                $order->payment_method,
                $order->subtotal,
                $order->tax,
                $order->shipping,
                $order->discount,
                $order->total,
            ];
        }

        $filename = 'orders_export_' . now()->format('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($csvData) {
            $file = fopen('php://output', 'w');
            // Add BOM for proper Excel encoding
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));
            foreach ($csvData as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    // ========== CUSTOMER MANAGEMENT ==========

    /**
     * List all customers with stats
     */
    public function customers(Request $request): JsonResponse
    {
        $query = User::where('role', 'customer');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        // Add order stats
        $query->withCount('orders')
            ->withSum(['orders' => function ($q) {
                $q->where('order_status', 'completed');
            }], 'total');

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        switch ($sortBy) {
            case 'orders':
                $query->orderBy('orders_count', $sortOrder);
                break;
            case 'spent':
                $query->orderBy('orders_sum_total', $sortOrder);
                break;
            case 'name':
                $query->orderBy('name', $sortOrder);
                break;
            default:
                $query->orderBy('created_at', $sortOrder);
        }

        $customers = $query->paginate($request->get('per_page', 15));

        return $this->paginated($customers);
    }

    /**
     * Get customer detail with order history and stats
     */
    public function customerShow(int $id): JsonResponse
    {
        $customer = User::where('role', 'customer')
            ->withCount('orders')
            ->withCount('tickets')
            ->withCount('reviews')
            ->withSum(['orders' => function ($q) {
                $q->where('order_status', 'completed');
            }], 'total')
            ->findOrFail($id);

        // Recent orders
        $recentOrders = Order::where('customer_id', $id)
            ->with(['vendorProfile'])
            ->latest()
            ->take(10)
            ->get();

        // Recent tickets
        $recentTickets = Ticket::where('user_id', $id)
            ->latest()
            ->take(5)
            ->get();

        return $this->success([
            'customer' => new UserResource($customer),
            'stats' => [
                'total_orders' => $customer->orders_count,
                'total_spent' => (float) ($customer->orders_sum_total ?? 0),
                'total_tickets' => $customer->tickets_count,
                'total_reviews' => $customer->reviews_count,
                'member_since' => $customer->created_at->format('Y-m-d'),
                'last_active' => $customer->updated_at->format('Y-m-d H:i:s'),
            ],
            'recent_orders' => OrderResource::collection($recentOrders),
            'recent_tickets' => TicketResource::collection($recentTickets),
        ]);
    }

    /**
     * Update customer (ban/unban, update role)
     */
    public function customerUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'sometimes|in:active,inactive,suspended',
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $id,
            'phone' => 'sometimes|string|max:20',
            'reason' => 'nullable|string|max:500',
        ]);

        $admin = $request->user();
        $customer = User::where('role', 'customer')->findOrFail($id);

        $oldData = $customer->only(['name', 'email', 'phone', 'status']);

        $customer->update($request->only(['name', 'email', 'phone', 'status']));

        AuditLog::log($admin, 'update_customer', 'User', $customer->id, $oldData, $customer->only(['name', 'email', 'phone', 'status']), 'Customer updated by admin');

        // Notify customer if status changed
        if ($request->has('status') && $oldData['status'] !== $request->status) {
            Notification::notify(
                $customer,
                'account_status_changed',
                'Account Status Updated',
                "Your account status has been changed to {$request->status}" . ($request->reason ? ". Reason: {$request->reason}" : ''),
                ['status' => $request->status, 'reason' => $request->reason],
                '/account'
            );
        }

        return $this->success(new UserResource($customer->fresh()), 'Customer updated');
    }

    /**
     * Soft delete customer
     */
    public function customerDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $customer = User::where('role', 'customer')->findOrFail($id);

        AuditLog::log($admin, 'delete_customer', 'User', $customer->id, $customer->toArray(), null, 'Customer soft-deleted by admin');

        $customer->delete();

        return $this->success(null, 'Customer deleted');
    }

    // ========== ENHANCED TICKET MANAGEMENT ==========

    /**
     * Update ticket (status, priority, assignment)
     */
    public function ticketUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'sometimes|in:open,in_progress,waiting_vendor,waiting_customer,resolved,closed',
            'priority' => 'sometimes|in:low,medium,high,urgent',
            'assigned_to' => 'sometimes|in:admin,vendor',
            'assigned_user_id' => 'nullable|exists:users,id',
        ]);

        $admin = $request->user();
        $ticket = Ticket::with(['user'])->findOrFail($id);

        $oldData = $ticket->only(['status', 'priority', 'assigned_to', 'assigned_user_id']);

        $updateData = $request->only(['status', 'priority', 'assigned_to', 'assigned_user_id']);

        // Set timestamps based on status
        if (isset($updateData['status'])) {
            switch ($updateData['status']) {
                case 'resolved':
                    $updateData['resolved_at'] = now();
                    break;
                case 'closed':
                    $updateData['closed_at'] = now();
                    break;
            }
        }

        $ticket->update($updateData);

        AuditLog::log($admin, 'update_ticket', 'Ticket', $ticket->id, $oldData, $updateData, 'Ticket updated by admin');

        // Notify ticket owner
        if ($ticket->user) {
            $changes = [];
            if (isset($updateData['status'])) {
                $changes[] = "status changed to {$updateData['status']}";
            }
            if (isset($updateData['priority'])) {
                $changes[] = "priority changed to {$updateData['priority']}";
            }

            if (!empty($changes)) {
                Notification::notify(
                    $ticket->user,
                    'ticket_updated',
                    'Ticket Updated',
                    "Your ticket #{$ticket->ticket_number}: " . implode(', ', $changes),
                    ['ticket_id' => $ticket->id],
                    "/tickets/{$ticket->id}"
                );
            }
        }

        return $this->success(new TicketResource($ticket->fresh()), 'Ticket updated');
    }

    /**
     * Admin reply to ticket
     */
    public function ticketReply(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'message' => 'required|string',
            'is_internal_note' => 'sometimes|boolean',
            'attachments' => 'nullable|array',
            'attachments.*' => 'file|max:5120',
        ]);

        $admin = $request->user();
        $ticket = Ticket::with(['user'])->findOrFail($id);

        if ($ticket->isClosed()) {
            return $this->error('Cannot reply to a closed ticket', 400);
        }

        // Handle attachments
        $attachments = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $attachments[] = $file->store('ticket-attachments', 'public');
            }
        }

        $message = TicketMessage::create([
            'ticket_id' => $ticket->id,
            'user_id' => $admin->id,
            'message' => $request->message,
            'attachments' => !empty($attachments) ? $attachments : null,
            'is_internal_note' => $request->boolean('is_internal_note', false),
        ]);

        // Update ticket status
        if (!$request->boolean('is_internal_note', false)) {
            $ticket->update(['status' => 'waiting_customer']);

            // Notify ticket owner
            if ($ticket->user) {
                Notification::notify(
                    $ticket->user,
                    'ticket_reply',
                    'New Reply on Your Ticket',
                    "Admin replied to your ticket #{$ticket->ticket_number}",
                    ['ticket_id' => $ticket->id],
                    "/tickets/{$ticket->id}"
                );
            }
        }

        return $this->success(new TicketMessageResource($message->load('user')), 'Reply added');
    }

    /**
     * Delete (soft delete) ticket
     */
    public function ticketDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $ticket = Ticket::findOrFail($id);

        AuditLog::log($admin, 'delete_ticket', 'Ticket', $ticket->id, $ticket->toArray(), null, 'Ticket deleted by admin');

        $ticket->delete();

        return $this->success(null, 'Ticket deleted');
    }

    // ========== ENHANCED SETTINGS ==========

    /**
     * Regenerate API keys
     */
    public function settingsRegenerateApiKey(Request $request): JsonResponse
    {
        $admin = $request->user();

        $newApiKey = Str::random(64);

        SiteSetting::set('api_key', $newApiKey, 'text', 'api_keys');
        SiteSetting::set('api_key_generated_at', now()->toISOString(), 'text', 'api_keys');

        AuditLog::log($admin, 'regenerate_api_key', 'SiteSetting', null, null, [
            'generated_at' => now()->toISOString(),
        ], 'API key regenerated');

        return $this->success([
            'api_key' => $newApiKey,
            'generated_at' => now()->toISOString(),
        ], 'API key regenerated');
    }

    // ========== ADMIN SERVICES MANAGEMENT ==========

    /**
     * List all services (admin)
     */
    public function adminServices(Request $request): JsonResponse
    {
        $query = Service::with(['category', 'vendorProfile', 'creator:id,name']);

        // Filter by category
        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by vendor
        if ($request->has('vendor_id')) {
            $query->where('vendor_profile_id', $request->vendor_id);
        }

        // Filter by status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filter by featured
        if ($request->has('is_featured')) {
            $query->where('is_featured', $request->boolean('is_featured'));
        }

        // Price range
        if ($request->has('min_price')) {
            $query->where('base_price', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('base_price', '<=', $request->max_price);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $services = $query->paginate($request->get('per_page', 15));

        return $this->paginated($services);
    }

    /**
     * Create service (admin)
     */
    public function adminServiceStore(Request $request): JsonResponse
    {
        // Support both field name formats (from admin panel and direct API)
        $request->validate([
            'vendor_profile_id' => 'nullable|exists:vendor_profiles,id',
            'service_category_id' => 'required_without:category_id|exists:service_categories,id',
            'category_id' => 'required_without:service_category_id|exists:service_categories,id',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'required_without:base_price|numeric|min:0',
            'base_price' => 'required_without:price|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'estimated_duration' => 'nullable|string|max:100',
            'duration_estimate' => 'nullable|string|max:100',
            'image' => 'nullable|image|max:4096',
            'gallery' => 'nullable|array|max:10',
            'gallery.*' => 'image|max:4096',
            'features' => 'nullable|array',
            'features.*' => 'string|max:255',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $admin = $request->user();

        // Map field names from admin panel format to model format
        $data = [];
        $data['vendor_profile_id'] = $request->vendor_profile_id;
        $data['features'] = $request->input('features', []);
        $data['category_id'] = $request->service_category_id ?? $request->category_id;
        $data['name'] = $request->name;
        $data['name_bn'] = $request->name_bn;
        $data['description'] = $request->description;
        $data['short_description'] = $request->short_description;
        $data['base_price'] = $request->price ?? $request->base_price;
        $data['discount_price'] = $request->sale_price ?? $request->discount_price;
        $data['duration_estimate'] = $request->estimated_duration ?? $request->duration_estimate;
        $data['is_active'] = $request->boolean('is_active', true);
        $data['is_featured'] = $request->boolean('is_featured', false);
        $data['sort_order'] = $request->sort_order ?? 0;
        $data['created_by'] = $admin->id;

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('services', 'public');
        }

        if ($request->hasFile('gallery')) {
            $galleryPaths = [];
            foreach ($request->file('gallery') as $img) {
                $galleryPaths[] = $img->store('services', 'public');
            }
            $data['gallery'] = $galleryPaths;
        }

        $data['code'] = 'SVC-' . strtoupper(Str::random(8));

        $service = Service::create($data);

        AuditLog::log($admin, 'create_service', 'Service', $service->id, null, $service->toArray(), 'Service created by admin');

        return $this->created(new ServiceResource($service->load(['category', 'vendorProfile'])), 'Service created');
    }

    /**
     * Update service (admin)
     */
    public function adminServiceUpdate(Request $request, int $id): JsonResponse
    {
        // Support both field name formats (from admin panel and direct API)
        $request->validate([
            'vendor_profile_id' => 'nullable|exists:vendor_profiles,id',
            'service_category_id' => 'nullable|exists:service_categories,id',
            'category_id' => 'nullable|exists:service_categories,id',
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'nullable|numeric|min:0',
            'base_price' => 'nullable|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'estimated_duration' => 'nullable|string|max:100',
            'duration_estimate' => 'nullable|string|max:100',
            'image' => 'nullable|image|max:4096',
            'gallery' => 'nullable|array|max:10',
            'gallery.*' => 'image|max:4096',
            'features' => 'nullable|array',
            'features.*' => 'string|max:255',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $admin = $request->user();
        $service = Service::findOrFail($id);

        $oldData = $service->toArray();

        // Map field names from admin panel format to model format
        $data = [];
        if ($request->has('vendor_profile_id')) {
            $data['vendor_profile_id'] = $request->vendor_profile_id;
        }
        if ($request->has('service_category_id') || $request->has('category_id')) {
            $data['category_id'] = $request->service_category_id ?? $request->category_id;
        }
        if ($request->has('name')) {
            $data['name'] = $request->name;
        }
        if ($request->has('name_bn')) {
            $data['name_bn'] = $request->name_bn;
        }
        if ($request->has('description')) {
            $data['description'] = $request->description;
        }
        if ($request->has('short_description')) {
            $data['short_description'] = $request->short_description;
        }
        if ($request->has('price') || $request->has('base_price')) {
            $data['base_price'] = $request->price ?? $request->base_price;
        }
        if ($request->has('sale_price') || $request->has('discount_price')) {
            $data['discount_price'] = $request->sale_price ?? $request->discount_price;
        }
        if ($request->has('estimated_duration') || $request->has('duration_estimate')) {
            $data['duration_estimate'] = $request->estimated_duration ?? $request->duration_estimate;
        }
        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if ($request->has('is_featured')) {
            $data['is_featured'] = $request->boolean('is_featured');
        }
        if ($request->has('sort_order')) {
            $data['sort_order'] = $request->sort_order;
        }
        if ($request->boolean('features_provided') || $request->has('features')) {
            $data['features'] = $request->input('features', []);
        }

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('services', 'public');
        }

        if ($request->hasFile('gallery')) {
            $galleryPaths = [];
            foreach ($request->file('gallery') as $img) {
                $galleryPaths[] = $img->store('services', 'public');
            }
            $data['gallery'] = $galleryPaths;
        }

        $service->update($data);

        AuditLog::log($admin, 'update_service', 'Service', $service->id, $oldData, $service->toArray(), 'Service updated by admin');

        return $this->success(new ServiceResource($service->fresh(['category', 'vendorProfile'])), 'Service updated');
    }

    /**
     * Delete service (admin)
     */
    public function adminServiceDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $service = Service::findOrFail($id);

        AuditLog::log($admin, 'delete_service', 'Service', $service->id, $service->toArray(), null, 'Service deleted by admin');

        $service->delete();

        return $this->success(null, 'Service deleted');
    }

    /**
     * Toggle service active status (admin)
     */
    public function adminServiceToggleStatus(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $service = Service::findOrFail($id);

        $oldStatus = $service->is_active;
        $service->update(['is_active' => !$oldStatus]);

        AuditLog::log($admin, 'toggle_service_status', 'Service', $service->id, [
            'is_active' => $oldStatus,
        ], [
            'is_active' => !$oldStatus,
        ], 'Service status toggled');

        return $this->success(new ServiceResource($service->fresh(['category', 'vendorProfile'])), $service->is_active ? 'Service activated' : 'Service deactivated');
    }

    // ========== ADMIN PRODUCTS ==========

    /**
     * List products (admin)
     */
    /**
     * Specification keys (and their most common values) already used by other
     * products in a category, so the "Technical Specifications" form can
     * suggest quick-add chips instead of the admin retyping the same spec
     * names (e.g. "RAM", "Processor") for every product in a category.
     */
    public function adminProductSpecSuggestions(Request $request): JsonResponse
    {
        $request->validate(['category_id' => 'required|integer|exists:product_categories,id']);

        $products = Product::where('category_id', $request->category_id)
            ->whereNotNull('specifications')
            ->latest()
            ->limit(200)
            ->get(['specifications']);

        // key => [value => occurrence count]
        $suggestions = [];
        foreach ($products as $product) {
            $specs = $product->specifications;
            if (!is_array($specs)) {
                continue;
            }
            foreach ($specs as $key => $value) {
                $key = trim((string) $key);
                $value = trim((string) $value);
                if ($key === '') {
                    continue;
                }
                $suggestions[$key] ??= [];
                if ($value !== '') {
                    $suggestions[$key][$value] = ($suggestions[$key][$value] ?? 0) + 1;
                }
            }
        }

        // $suggestions keys/values are already in most-recently-used-first order,
        // since $products is fetched latest() and PHP arrays keep first-insertion order.
        $result = [];
        foreach ($suggestions as $key => $values) {
            $result[] = [
                'key' => $key,
                'values' => array_slice(array_keys($values), 0, 8),
                'count' => array_sum($values),
            ];
        }

        return $this->success(array_slice($result, 0, 30));
    }

    public function adminProducts(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'vendorProfile', 'brand', 'creator:id,name']);

        // Filter by category
        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by vendor
        if ($request->has('vendor_id')) {
            $query->where('vendor_profile_id', $request->vendor_id);
        }

        // Filter by brand
        if ($request->has('brand_id')) {
            $query->where('brand_id', $request->brand_id);
        }

        // Filter by status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filter by featured
        if ($request->has('is_featured')) {
            $query->where('is_featured', $request->boolean('is_featured'));
        }

        // Filter by draft status — instant products quick-created from Order/Purchase
        // Order forms (minimal fields, is_active=false) that still need full cataloging.
        if ($request->has('is_draft')) {
            $query->where('is_draft', $request->boolean('is_draft'));
        }

        // Filter by stock status — always_in_stock overrides the raw quantity everywhere else
        // (storefront, isInStock()), so "out of stock" here must exclude it too, or every
        // always-in-stock item (stock_qty left at 0 on purpose) wrongly shows as out of stock.
        if ($request->has('stock_status')) {
            if ($request->stock_status === 'low') {
                $query->lowStock();
            } elseif ($request->stock_status === 'out') {
                $query->where('stock_qty', 0)->where('always_in_stock', false);
            } elseif ($request->stock_status === 'in') {
                $query->inStock();
            }
        }

        // Price range
        if ($request->has('min_price')) {
            $query->where('price', '>=', $request->min_price);
        }
        if ($request->has('max_price')) {
            $query->where('price', '<=', $request->max_price);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('brand', 'like', "%{$search}%")
                    ->orWhereHas('brand', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $products = $query->paginate($request->get('per_page', 15));

        return $this->paginated($products);
    }

    /**
     * Product counts by status, independent of whatever filter/pagination is currently
     * applied on the list — the tab badges and stat cards need the true totals for every
     * category regardless of which tab the admin is actually viewing.
     */
    public function adminProductStats(): JsonResponse
    {
        return $this->success([
            'total' => Product::count(),
            'active' => Product::where('is_active', true)->count(),
            'inactive' => Product::where('is_active', false)->count(),
            'draft' => Product::where('is_draft', true)->count(),
            'low_stock' => Product::lowStock()->count(),
            'out_of_stock' => Product::where('stock_qty', 0)->where('always_in_stock', false)->count(),
        ]);
    }

    /**
     * Show single product (admin)
     */
    public function adminProductShow(int $id): JsonResponse
    {
        $product = Product::with([
            'category',
            'vendorProfile',
            'brand',
            'inventoryLogs',
            'attributeValues.attribute',
            'attributeValues.attributeValue',
            'creator:id,name',
            'serials' => fn ($q) => $q->latest(),
        ])->findOrFail($id);

        return $this->success(new ProductResource($product));
    }

    /**
     * Create product (admin)
     */
    public function adminProductStore(Request $request): JsonResponse
    {
        $request->validate([
            'vendor_profile_id' => 'nullable|exists:vendor_profiles,id',
            'category_id' => 'required|exists:product_categories,id',
            'brand_id' => 'nullable|exists:product_brands,id',
            'sku' => 'nullable|string|max:191|unique:products,sku',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'required|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'stock_qty' => 'required|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'always_in_stock' => 'nullable',
            'current_cost' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'image' => 'nullable|image|max:4096',
            'gallery' => 'nullable|array',
            'gallery.*' => 'image|max:4096',
            'specifications' => 'nullable',
            'attribute_values' => 'nullable',
            'brand' => 'nullable|string|max:255', // Deprecated, use brand_id
            'model' => 'nullable|string|max:255',
            'warranty' => 'nullable|string|max:255',
            'warranty_value' => 'nullable|integer|min:0',
            'warranty_unit' => 'nullable|in:day,week,month,year',
            'is_active' => 'nullable',
            'is_draft' => 'nullable',
            'is_featured' => 'nullable',
            'sort_order' => 'nullable|integer',
        ]);

        $admin = $request->user();

        $data = $request->only([
            'vendor_profile_id', 'category_id', 'brand_id', 'sku', 'name', 'name_bn',
            'description', 'short_description', 'price', 'discount_price',
            'stock_qty', 'low_stock_threshold', 'current_cost', 'unit', 'brand', 'model',
            'warranty', 'warranty_value', 'warranty_unit', 'is_active', 'is_featured', 'sort_order',
        ]);
        // New products default to "always in stock" — most items here are effectively
        // made-to-order/replenished-on-demand, so untracked availability is the norm rather
        // than the exception; an admin can uncheck it for anything that needs real counting.
        $data['always_in_stock'] = $request->boolean('always_in_stock', true);

        // Handle main image upload
        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        // Handle gallery images upload
        if ($request->hasFile('gallery')) {
            $galleryPaths = [];
            foreach ($request->file('gallery') as $image) {
                $galleryPaths[] = $image->store('products/gallery', 'public');
            }
            $data['gallery'] = $galleryPaths;
        }

        // Handle specifications as JSON (from FormData it comes as string)
        if ($request->has('specifications')) {
            $specs = $request->specifications;
            if (is_string($specs)) {
                $data['specifications'] = json_decode($specs, true);
            } else {
                $data['specifications'] = $specs;
            }
        }

        $data['is_active'] = $request->boolean('is_active', true);
        $data['is_draft'] = $request->boolean('is_draft', false);
        $data['is_featured'] = $request->boolean('is_featured', false);
        $data['sort_order'] = $request->sort_order ?? 0;
        $data['low_stock_threshold'] = $request->low_stock_threshold ?? 5;
        $data['unit'] = $request->unit ?? 'piece';
        $data['created_by'] = $admin->id;

        $product = Product::create($data);

        $this->syncProductAttributeValues($product, $request->input('attribute_values'));

        AuditLog::log($admin, 'create_product', 'Product', $product->id, null, $product->toArray(), 'Product created by admin');

        return $this->created(
            new ProductResource($product->load([
                'category', 'vendorProfile', 'brand',
                'attributeValues.attribute', 'attributeValues.attributeValue',
            ])),
            'Product created'
        );
    }

    /**
     * Update product (admin)
     */
    public function adminProductUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'vendor_profile_id' => 'nullable|exists:vendor_profiles,id',
            'category_id' => 'sometimes|exists:product_categories,id',
            'brand_id' => 'nullable|exists:product_brands,id',
            'sku' => 'nullable|string|max:191|unique:products,sku,' . $id,
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'price' => 'sometimes|numeric|min:0',
            'discount_price' => 'nullable|numeric|min:0',
            'stock_qty' => 'sometimes|integer|min:0',
            'low_stock_threshold' => 'nullable|integer|min:0',
            'always_in_stock' => 'nullable',
            'current_cost' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'image' => 'nullable|image|max:4096',
            'gallery' => 'nullable|array',
            'gallery.*' => 'image|max:4096',
            'specifications' => 'nullable',
            'attribute_values' => 'nullable',
            'brand' => 'nullable|string|max:255', // Deprecated, use brand_id
            'model' => 'nullable|string|max:255',
            'warranty' => 'nullable|string|max:255',
            'warranty_value' => 'nullable|integer|min:0',
            'warranty_unit' => 'nullable|in:day,week,month,year',
            'is_active' => 'nullable',
            'is_featured' => 'nullable',
            'sort_order' => 'nullable|integer',
        ]);

        $admin = $request->user();
        $product = Product::findOrFail($id);

        $oldData = $product->toArray();

        $data = $request->only([
            'vendor_profile_id', 'category_id', 'brand_id', 'sku', 'name', 'name_bn',
            'description', 'short_description', 'price', 'discount_price',
            'stock_qty', 'low_stock_threshold', 'current_cost', 'unit', 'brand', 'model',
            'warranty', 'warranty_value', 'warranty_unit', 'is_active', 'is_featured', 'sort_order',
        ]);

        // Handle main image upload
        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        // Handle gallery images upload
        if ($request->hasFile('gallery')) {
            $galleryPaths = [];
            foreach ($request->file('gallery') as $image) {
                $galleryPaths[] = $image->store('products/gallery', 'public');
            }
            $data['gallery'] = $galleryPaths;
        } elseif ($request->has('gallery') && is_array($request->gallery)) {
            // Allow updating gallery with array of existing paths or empty array
            $data['gallery'] = $request->gallery;
        }

        // Handle specifications as JSON (from FormData it comes as string)
        if ($request->has('specifications')) {
            $specs = $request->specifications;
            if (is_string($specs)) {
                $data['specifications'] = json_decode($specs, true);
            } else {
                $data['specifications'] = $specs;
            }
        }

        // Handle boolean fields from FormData
        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if ($request->has('is_featured')) {
            $data['is_featured'] = $request->boolean('is_featured');
        }
        if ($request->has('always_in_stock')) {
            $data['always_in_stock'] = $request->boolean('always_in_stock');
        }

        // Any save through the normal product edit form means the admin has now
        // reviewed/completed it — clear the instant-product draft flag so it drops
        // out of the "needs completion" filter regardless of what else changed.
        $data['is_draft'] = false;

        $product->update($data);

        if ($request->has('attribute_values')) {
            $this->syncProductAttributeValues($product, $request->input('attribute_values'));
        }

        AuditLog::log($admin, 'update_product', 'Product', $product->id, $oldData, $product->toArray(), 'Product updated by admin');

        return $this->success(
            new ProductResource($product->fresh([
                'category', 'vendorProfile', 'brand',
                'attributeValues.attribute', 'attributeValues.attributeValue',
            ])),
            'Product updated'
        );
    }

    /**
     * Sync a product's attribute values. Accepts either:
     *   array of { attribute_id, value_ids: [int,...] }         — select/multiselect
     *   array of { attribute_id, text_value: string }           — text/number (free entry)
     *   associative { attribute_id: [value_ids] }
     *   JSON string of any of the above (for FormData requests)
     */
    private function syncProductAttributeValues(Product $product, $input): void
    {
        if ($input === null || $input === '') {
            return;
        }

        if (is_string($input)) {
            $decoded = json_decode($input, true);
            if (!is_array($decoded)) {
                return;
            }
            $input = $decoded;
        }

        if (!is_array($input)) {
            return;
        }

        $rows = [];

        // Normalize to list of [attribute_id, attribute_value_id|null, text_value|null] rows
        if (array_is_list($input)) {
            foreach ($input as $entry) {
                if (!is_array($entry)) continue;
                $attrId = (int) ($entry['attribute_id'] ?? 0);
                if ($attrId <= 0) continue;

                $textValue = trim((string) ($entry['text_value'] ?? ''));
                if ($textValue !== '') {
                    $rows[] = ['attribute_id' => $attrId, 'attribute_value_id' => null, 'text_value' => $textValue];
                    continue;
                }

                $valueIds = $entry['value_ids'] ?? $entry['values'] ?? [];
                if (!is_array($valueIds)) $valueIds = [$valueIds];
                foreach ($valueIds as $vid) {
                    $vid = (int) $vid;
                    if ($vid > 0) {
                        $rows[] = ['attribute_id' => $attrId, 'attribute_value_id' => $vid, 'text_value' => null];
                    }
                }
            }
        } else {
            foreach ($input as $attrId => $valueIds) {
                $attrId = (int) $attrId;
                if ($attrId <= 0) continue;
                if (!is_array($valueIds)) $valueIds = [$valueIds];
                foreach ($valueIds as $vid) {
                    $vid = (int) $vid;
                    if ($vid > 0) {
                        $rows[] = ['attribute_id' => $attrId, 'attribute_value_id' => $vid, 'text_value' => null];
                    }
                }
            }
        }

        // Clear existing then re-insert
        $product->attributeValues()->delete();

        $now = now();
        $insert = array_map(function ($row) use ($product, $now) {
            return [
                'product_id' => $product->id,
                'attribute_id' => $row['attribute_id'],
                'attribute_value_id' => $row['attribute_value_id'],
                'text_value' => $row['text_value'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }, $rows);

        if (!empty($insert)) {
            \App\Models\ProductAttributeValue::insert($insert);
        }
    }

    /**
     * Delete product (admin)
     */
    public function adminProductDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $product = Product::findOrFail($id);

        AuditLog::log($admin, 'delete_product', 'Product', $product->id, $product->toArray(), null, 'Product deleted by admin');

        $product->delete();

        return $this->success(null, 'Product deleted');
    }

    /**
     * Toggle product active status (admin)
     */
    public function adminProductToggleStatus(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $product = Product::findOrFail($id);

        $oldStatus = $product->is_active;
        $product->update(['is_active' => !$oldStatus]);

        AuditLog::log($admin, 'toggle_product_status', 'Product', $product->id, [
            'is_active' => $oldStatus,
        ], [
            'is_active' => !$oldStatus,
        ], 'Product status toggled');

        return $this->success(new ProductResource($product->fresh(['category', 'vendorProfile', 'brand'])), $product->is_active ? 'Product activated' : 'Product deactivated');
    }

    /**
     * Toggle product featured status (admin)
     */
    public function adminProductToggleFeatured(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $product = Product::findOrFail($id);

        $oldFeatured = $product->is_featured;
        $product->update(['is_featured' => !$oldFeatured]);

        AuditLog::log($admin, 'toggle_product_featured', 'Product', $product->id, [
            'is_featured' => $oldFeatured,
        ], [
            'is_featured' => !$oldFeatured,
        ], 'Product featured status toggled');

        return $this->success(new ProductResource($product->fresh(['category', 'vendorProfile', 'brand'])), $product->is_featured ? 'Product marked as featured' : 'Product removed from featured');
    }

    /**
     * List a product's serial numbers (used by the order form's "pick a unit" selector, and by
     * the product edit screen to show what's already recorded).
     */
    public function adminProductSerials(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        // Only in-stock units — this feeds the order form's "pick a unit to sell" selector, so an
        // already-sold serial must never show up here as pickable again.
        $serials = $product->availableSerials()->latest()->get(['id', 'serial_number', 'status', 'created_at']);

        return $this->success($serials);
    }

    /**
     * Manually attach serial number(s) to a product's existing stock — for backfilling units
     * that were received before serial tracking existed (no purchase_order_item_id provenance).
     * Capped at the product's current stock_qty minus serials already recorded as in_stock, so
     * this can only ever identify units that are genuinely already counted in stock, never inflate
     * it.
     */
    public function adminProductAddSerials(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $admin = $request->user();

        $data = $request->validate([
            'serials' => 'required|array|min:1',
            'serials.*' => 'required|string|max:191',
        ]);

        $serials = array_values(array_unique(array_filter(array_map('trim', $data['serials']))));
        if (empty($serials)) {
            return $this->error('No valid serial numbers provided.', 422);
        }

        $alreadyRecorded = $product->availableSerials()->count();
        $unserializedRoom = max(0, $product->stock_qty - $alreadyRecorded);
        if (count($serials) > $unserializedRoom) {
            return $this->error(
                "Only {$unserializedRoom} unit(s) of this product's stock don't have a serial recorded yet — can't add " . count($serials) . '.',
                422
            );
        }

        foreach ($serials as $serial) {
            if (ProductSerial::where('product_id', $product->id)->where('serial_number', $serial)->exists()) {
                return $this->error("Serial number \"{$serial}\" already exists for this product.", 422);
            }
        }

        foreach ($serials as $serial) {
            $product->serials()->create([
                'serial_number' => $serial,
                'status' => 'in_stock',
                'added_by' => $admin->id,
            ]);
        }

        AuditLog::log($admin, 'add_product_serials', 'Product', $product->id, null, ['serials' => $serials], 'Serial numbers added to existing stock');

        return $this->success($product->serials()->latest()->get(['id', 'serial_number', 'status', 'created_at']), 'Serial numbers added');
    }

    // ========== PRODUCT BRANDS ==========

    /**
     * List product brands (admin)
     */
    public function adminProductBrands(Request $request): JsonResponse
    {
        $query = ProductBrand::query();

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('name_bn', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'sort_order');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // With product count
        $query->withCount('products');

        $brands = $query->paginate($request->get('per_page', 15));

        return $this->success(ProductBrandResource::collection($brands)->response()->getData(true));
    }

    /**
     * Get single brand (admin)
     */
    public function adminProductBrandShow(int $id): JsonResponse
    {
        $brand = ProductBrand::withCount('products')->findOrFail($id);
        return $this->success(new ProductBrandResource($brand));
    }

    /**
     * Create new brand (admin)
     */
    public function adminProductBrandStore(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:product_brands,name',
            'name_bn' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255|unique:product_brands,slug',
            'logo' => 'nullable|image|max:2048',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $admin = $request->user();

        $data = $request->only(['name', 'name_bn', 'slug', 'description', 'is_active', 'sort_order']);

        // Handle logo upload
        if ($request->hasFile('logo')) {
            $data['logo'] = $request->file('logo')->store('brands', 'public');
        }

        $data['is_active'] = $request->boolean('is_active', true);
        $data['sort_order'] = $request->sort_order ?? 0;

        $brand = ProductBrand::create($data);

        AuditLog::log($admin, 'create_brand', 'ProductBrand', $brand->id, null, $brand->toArray(), 'Product brand created by admin');

        return $this->created(new ProductBrandResource($brand), 'Brand created');
    }

    /**
     * Update brand (admin)
     */
    public function adminProductBrandUpdate(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255|unique:product_brands,name,' . $id,
            'name_bn' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255|unique:product_brands,slug,' . $id,
            'logo' => 'nullable|image|max:2048',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $admin = $request->user();
        $brand = ProductBrand::findOrFail($id);

        $oldData = $brand->toArray();

        $data = $request->only(['name', 'name_bn', 'slug', 'description', 'is_active', 'sort_order']);

        // Handle logo upload
        if ($request->hasFile('logo')) {
            $data['logo'] = $request->file('logo')->store('brands', 'public');
        }

        $brand->update($data);

        AuditLog::log($admin, 'update_brand', 'ProductBrand', $brand->id, $oldData, $brand->toArray(), 'Product brand updated by admin');

        return $this->success(new ProductBrandResource($brand->fresh()), 'Brand updated');
    }

    /**
     * Delete brand (admin)
     */
    public function adminProductBrandDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $brand = ProductBrand::findOrFail($id);

        // Check if brand has products
        if ($brand->products()->count() > 0) {
            return $this->error('Cannot delete brand with associated products', 422);
        }

        $oldData = $brand->toArray();
        $brand->delete();

        AuditLog::log($admin, 'delete_brand', 'ProductBrand', $id, $oldData, null, 'Product brand deleted by admin');

        return $this->success(null, 'Brand deleted');
    }

    /**
     * Toggle brand active status (admin)
     */
    public function adminProductBrandToggleStatus(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $brand = ProductBrand::findOrFail($id);

        $oldStatus = $brand->is_active;
        $brand->update(['is_active' => !$oldStatus]);

        AuditLog::log($admin, 'toggle_brand_status', 'ProductBrand', $brand->id, [
            'is_active' => $oldStatus,
        ], [
            'is_active' => !$oldStatus,
        ], 'Brand status toggled');

        return $this->success(new ProductBrandResource($brand->fresh()), $brand->is_active ? 'Brand activated' : 'Brand deactivated');
    }

    // ========== ADMIN NOTIFICATIONS ==========

    /**
     * List admin notifications
     */
    public function adminNotifications(Request $request): JsonResponse
    {
        $admin = $request->user();

        $query = Notification::where('user_id', $admin->id);

        // Filter by read status
        if ($request->has('is_read')) {
            if ($request->boolean('is_read')) {
                $query->read();
            } else {
                $query->unread();
            }
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $notifications = $query->latest()->paginate($request->get('per_page', 20));

        return $this->paginated($notifications);
    }

    /**
     * Mark admin notification as read
     */
    public function adminNotificationMarkRead(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();

        $notification = Notification::where('user_id', $admin->id)->findOrFail($id);
        $notification->markAsRead();

        return $this->success(new NotificationResource($notification->fresh()), 'Notification marked as read');
    }

    /**
     * Mark all admin notifications as read
     */
    public function adminNotificationMarkAllRead(Request $request): JsonResponse
    {
        $admin = $request->user();

        Notification::where('user_id', $admin->id)
            ->unread()
            ->update(['read_at' => now()]);

        return $this->success(null, 'All notifications marked as read');
    }

    /**
     * Delete admin notification
     */
    public function adminNotificationDelete(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();

        $notification = Notification::where('user_id', $admin->id)->findOrFail($id);
        $notification->delete();

        return $this->success(null, 'Notification deleted');
    }

    // ========== ENHANCED DASHBOARD ==========

    /**
     * Enhanced dashboard with trends
     */
    public function dashboardWithTrends(Request $request): JsonResponse
    {
        // Current period
        $endDate = now()->endOfDay();
        $startDate = now()->startOfMonth();

        // Previous period (for trends)
        $prevEndDate = now()->subMonth()->endOfMonth();
        $prevStartDate = now()->subMonth()->startOfMonth();

        // Current period stats
        $currentOrders = Order::whereBetween('created_at', [$startDate, $endDate]);
        $prevOrders = Order::whereBetween('created_at', [$prevStartDate, $prevEndDate]);

        $currentRevenue = (float) (clone $currentOrders)->where('order_status', 'completed')->sum('total');
        $prevRevenue = (float) (clone $prevOrders)->where('order_status', 'completed')->sum('total');

        $currentOrderCount = (clone $currentOrders)->count();
        $prevOrderCount = (clone $prevOrders)->count();

        $currentCustomers = User::where('role', 'customer')->whereBetween('created_at', [$startDate, $endDate])->count();
        $prevCustomers = User::where('role', 'customer')->whereBetween('created_at', [$prevStartDate, $prevEndDate])->count();

        $currentProducts = Product::whereBetween('created_at', [$startDate, $endDate])->count();
        $prevProducts = Product::whereBetween('created_at', [$prevStartDate, $prevEndDate])->count();

        // Calculate trends (percentage change)
        $calcTrend = function ($current, $previous) {
            if ($previous == 0) {
                return $current > 0 ? 100 : 0;
            }
            return round((($current - $previous) / $previous) * 100, 1);
        };

        // User statistics
        $userStats = User::selectRaw('
            COUNT(*) as total_users,
            SUM(CASE WHEN role = "customer" THEN 1 ELSE 0 END) as total_customers,
            SUM(CASE WHEN role = "vendor" THEN 1 ELSE 0 END) as total_vendors,
            SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_users
        ')->first();

        // Vendor statistics
        $vendorStats = VendorProfile::selectRaw('
            COUNT(*) as total_vendors,
            SUM(CASE WHEN status = "approved" THEN 1 ELSE 0 END) as approved_vendors,
            SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_vendors,
            SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as rejected_vendors
        ')->first();

        // All-time order statistics. total_revenue excludes refunded/cancelled/never-paid orders —
        // see the same fix in dashboard() above for why (otherwise reversed refunds still count as revenue).
        $allTimeOrders = Order::selectRaw('
            COUNT(*) as total_orders,
            SUM(CASE WHEN payment_status IN ("paid", "partially_paid", "verified") THEN total ELSE 0 END) as total_revenue,
            SUM(CASE WHEN order_status = "completed" THEN total ELSE 0 END) as completed_revenue,
            SUM(CASE WHEN order_status = "pending" THEN 1 ELSE 0 END) as pending_orders,
            SUM(CASE WHEN order_status = "completed" THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN order_status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders
        ')->first();

        // Pending items
        $pendingVendors = VendorProfile::where('status', 'pending')->count();
        $pendingTickets = Ticket::where('status', 'open')->count();
        $pendingReviews = Review::where('status', 'pending')->count();

        // Recent activity
        $recentOrders = Order::with(['customer', 'vendorProfile'])
            ->latest()
            ->take(5)
            ->get();

        $recentVendors = VendorProfile::with('user')
            ->where('status', 'pending')
            ->latest()
            ->take(5)
            ->get();

        $recentTickets = Ticket::with(['user'])
            ->where('status', 'open')
            ->latest()
            ->take(5)
            ->get();

        // Low stock alerts
        $lowStockProducts = Product::where('is_active', true)
            ->whereColumn('stock_qty', '<=', 'low_stock_threshold')
            ->with('vendorProfile:id,business_name')
            ->take(10)
            ->get(['id', 'name', 'sku', 'stock_qty', 'low_stock_threshold', 'vendor_profile_id']);

        // Revenue chart data (last 30 days)
        $revenueChart = Order::where('order_status', 'completed')
            ->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return $this->success([
            'statistics' => [
                'users' => [
                    'total' => (int) $userStats->total_users,
                    'customers' => (int) $userStats->total_customers,
                    'vendors' => (int) $userStats->total_vendors,
                    'active' => (int) $userStats->active_users,
                ],
                'vendors' => [
                    'total' => (int) $vendorStats->total_vendors,
                    'approved' => (int) $vendorStats->approved_vendors,
                    'pending' => (int) $vendorStats->pending_vendors,
                    'rejected' => (int) $vendorStats->rejected_vendors,
                ],
                'orders' => [
                    'total' => (int) $allTimeOrders->total_orders,
                    'pending' => (int) $allTimeOrders->pending_orders,
                    'completed' => (int) $allTimeOrders->completed_orders,
                    'cancelled' => (int) $allTimeOrders->cancelled_orders,
                ],
                'revenue' => [
                    'total' => (float) ($allTimeOrders->total_revenue ?? 0),
                    'completed' => (float) ($allTimeOrders->completed_revenue ?? 0),
                    'current_month' => $currentRevenue,
                ],
                'catalog' => [
                    'products' => Product::count(),
                    'services' => Service::count(),
                ],
                'pending_actions' => [
                    'vendors' => $pendingVendors,
                    'tickets' => $pendingTickets,
                    'reviews' => $pendingReviews,
                ],
            ],
            'trends' => [
                'revenue' => $calcTrend($currentRevenue, $prevRevenue),
                'orders' => $calcTrend($currentOrderCount, $prevOrderCount),
                'customers' => $calcTrend($currentCustomers, $prevCustomers),
                'products' => $calcTrend($currentProducts, $prevProducts),
            ],
            'recent_orders' => OrderResource::collection($recentOrders),
            'recent_tickets' => TicketResource::collection($recentTickets),
            'pending_vendors' => VendorProfileResource::collection($recentVendors),
            'low_stock_alerts' => $lowStockProducts,
            'revenue_chart' => $revenueChart,
        ]);
    }
}
