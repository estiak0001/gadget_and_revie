<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionController extends Controller
{
    use ApiResponse;

    /**
     * Permission names are `verb_noun` (e.g. "manage_users", "view_orders"), not dot-namespaced.
     * Strip the leading verb and map the remaining noun to a human module label — chosen to line
     * up 1:1 with the admin sidebar's menu sections, so grouping permissions by module doubles as
     * grouping them by "which menu does this unlock".
     */
    private function resolveModule(string $name): string
    {
        static $map = [
            'users' => 'Users', 'user_status' => 'Users', 'user_password' => 'Users',
            'vendors' => 'Vendors', 'categories' => 'Categories',
            'locations' => 'Locations', 'divisions' => 'Locations', 'districts' => 'Locations', 'areas' => 'Locations',
            'services' => 'Services', 'service_status' => 'Services',
            'products' => 'Products', 'product_status' => 'Products', 'product_featured' => 'Products',
            'inventory' => 'Products', 'orders' => 'Orders', 'payment_amounts' => 'Orders', 'custom_invoices' => 'Orders',
            'paid_orders' => 'Orders',
            'reviews' => 'Reviews',
            'tickets' => 'Tickets', 'cms' => 'Content (CMS)', 'cms_pages' => 'Content (CMS)',
            'banners' => 'Content (CMS)', 'faqs' => 'Content (CMS)',
            'branch_locations' => 'Content (CMS)', 'contact_inquiries' => 'Content (CMS)',
            'settings' => 'Settings', 'api_keys' => 'Settings',
            'reports' => 'Reports', 'sales_reports' => 'Reports', 'vendor_reports' => 'Reports',
            'customer_reports' => 'Reports', 'catalog_reports' => 'Reports', 'review_reports' => 'Reports',
            'ticket_reports' => 'Reports',
            'audit_logs' => 'Audit Logs', 'purchases' => 'Purchases', 'purchase_orders' => 'Purchases',
            'suppliers' => 'Purchases',
            'accounts' => 'Accounts & Finance', 'ledger' => 'Accounts & Finance',
            'financial_statements' => 'Accounts & Finance', 'chart_of_accounts' => 'Accounts & Finance',
            'journal_entries' => 'Accounts & Finance', 'pending_ledger_items' => 'Accounts & Finance',
            'expenses' => 'Expenses',
            'roles' => 'Roles & Permissions', 'role_definitions' => 'Roles & Permissions',
            'service_intakes' => 'Service Intakes', 'service_intake_price' => 'Service Intakes',
            'payments' => 'Payments',
            'investors' => 'Investors', 'investor_returns' => 'Investors',
            'notifications' => 'Notifications',
        ];
        $verbs = [
            'manage', 'view', 'create', 'edit', 'delete', 'process', 'respond', 'approve', 'export',
            'update', 'reset', 'reject', 'suspend', 'refund', 'correct', 'convert', 'confirm', 'reorder',
            'reply', 'assign', 'close', 'moderate', 'regenerate', 'toggle', 'mark', 'receive', 'pay',
            'cancel', 'post', 'amend',
        ];
        $parts = explode('_', $name);
        if (in_array($parts[0], $verbs, true)) {
            array_shift($parts);
        }
        $key = implode('_', $parts);
        return $map[$key] ?? ucfirst(str_replace('_', ' ', $key));
    }

    /**
     * Get all permissions
     */
    public function index(Request $request)
    {
        $query = Permission::query();

        // Search
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        // Group permissions by module
        if ($request->boolean('grouped', false)) {
            $permissions = $query->orderBy('name')->get();

            $grouped = $permissions->groupBy(fn ($permission) => $this->resolveModule($permission->name));

            return $this->success($grouped, 'Permissions retrieved successfully');
        }

        $permissions = $query->orderBy('name')->get();
        $permissions->each(fn ($permission) => $permission->module = $this->resolveModule($permission->name));

        return $this->success($permissions, 'Permissions retrieved successfully');
    }

    /**
     * Get a specific permission
     */
    public function show($id)
    {
        $permission = Permission::with('roles:id,name')->find($id);

        if (!$permission) {
            return $this->error('Permission not found', 404);
        }

        $permission->module = $this->resolveModule($permission->name);

        return $this->success($permission, 'Permission retrieved successfully');
    }

    /**
     * Create a new permission
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:125|unique:permissions,name',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        try {
            $permission = Permission::create([
                'name' => $request->name,
                'guard_name' => 'web',
            ]);

            return $this->success($permission, 'Permission created successfully', 201);
        } catch (\Exception $e) {
            return $this->error('Failed to create permission: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Update a permission
     */
    public function update(Request $request, $id)
    {
        $permission = Permission::find($id);

        if (!$permission) {
            return $this->error('Permission not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:125|unique:permissions,name,' . $id,
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        try {
            $permission->update(['name' => $request->name]);
            return $this->success($permission, 'Permission updated successfully');
        } catch (\Exception $e) {
            return $this->error('Failed to update permission: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Delete a permission
     */
    public function destroy($id)
    {
        $permission = Permission::find($id);

        if (!$permission) {
            return $this->error('Permission not found', 404);
        }

        // Check if permission is assigned to any roles
        if ($permission->roles()->count() > 0) {
            return $this->error('Cannot delete permission assigned to roles. Remove from roles first.', 422);
        }

        try {
            $permission->delete();
            return $this->success(null, 'Permission deleted successfully');
        } catch (\Exception $e) {
            return $this->error('Failed to delete permission: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get permissions by role
     */
    public function getByRole($roleId)
    {
        $role = Role::find($roleId);

        if (!$role) {
            return $this->error('Role not found', 404);
        }

        $permissions = $role->permissions;

        return $this->success([
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
            ],
            'permissions' => $permissions,
        ], 'Permissions retrieved successfully');
    }

    /**
     * Assign permission to role
     */
    public function assignToRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role_id' => 'required|exists:roles,id',
            'permission_id' => 'required|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $role = Role::find($request->role_id);
        $permission = Permission::find($request->permission_id);

        // Check if role already has this permission
        if ($role->hasPermissionTo($permission->name)) {
            return $this->error('Role already has this permission', 422);
        }

        $role->givePermissionTo($permission);

        return $this->success([
            'role_id' => $role->id,
            'role_name' => $role->name,
            'permissions' => $role->permissions->pluck('name'),
        ], 'Permission assigned successfully');
    }

    /**
     * Remove permission from role
     */
    public function removeFromRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role_id' => 'required|exists:roles,id',
            'permission_id' => 'required|exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $role = Role::find($request->role_id);
        $permission = Permission::find($request->permission_id);

        // Check if role has this permission
        if (!$role->hasPermissionTo($permission->name)) {
            return $this->error('Role does not have this permission', 422);
        }

        $role->revokePermissionTo($permission);

        return $this->success([
            'role_id' => $role->id,
            'role_name' => $role->name,
            'permissions' => $role->permissions->pluck('name'),
        ], 'Permission removed successfully');
    }

    /**
     * Sync multiple permissions to role (replace all permissions)
     */
    public function syncRolePermissions(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role_id' => 'required|exists:roles,id',
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $role = Role::find($request->role_id);
        $permissions = Permission::whereIn('id', $request->permission_ids)->get();

        $role->syncPermissions($permissions);

        return $this->success([
            'role_id' => $role->id,
            'role_name' => $role->name,
            'permissions' => $role->permissions->pluck('name'),
        ], 'Role permissions synced successfully');
    }

    /**
     * Bulk create permissions
     */
    public function bulkCreate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'permissions' => 'required|array|min:1',
            'permissions.*' => 'required|string|max:125',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $created = [];
        $skipped = [];

        foreach ($request->permissions as $permissionName) {
            // Check if already exists
            if (Permission::where('name', $permissionName)->exists()) {
                $skipped[] = $permissionName;
                continue;
            }

            $permission = Permission::create([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
            $created[] = $permission->name;
        }

        return $this->success([
            'created' => $created,
            'skipped' => $skipped,
        ], count($created) . ' permissions created, ' . count($skipped) . ' skipped (already exist)');
    }

    /**
     * Get available permission modules
     */
    public function getModules()
    {
        $permissions = Permission::all();

        $modules = $permissions->map(fn ($permission) => $this->resolveModule($permission->name))
            ->unique()
            ->values();

        return $this->success($modules, 'Permission modules retrieved successfully');
    }
}
