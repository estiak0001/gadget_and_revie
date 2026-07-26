<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    use ApiResponse;

    /**
     * Protected roles that cannot be edited or deleted — the 5 tier roles that AdminController's
     * `syncSelectedRole()`/`tierForRole()` rely on existing under exactly these names.
     */
    protected array $protectedRoles = ['admin', 'vendor', 'customer', 'staff', 'super_admin'];

    /**
     * Get all roles with permissions count
     */
    public function index(Request $request)
    {
        $query = Role::withCount('permissions')->with('permissions:id,name');

        // Search
        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        // Filter by guard
        if ($request->has('guard')) {
            $query->where('guard_name', $request->guard);
        }

        $roles = $query->orderBy('name')->get();

        // Add protected flag
        $roles->transform(function ($role) {
            $role->is_protected = in_array($role->name, $this->protectedRoles);
            return $role;
        });

        return $this->success($roles, 'Roles retrieved successfully');
    }

    /**
     * Get a specific role with permissions
     */
    public function show($id)
    {
        $role = Role::with('permissions:id,name')->find($id);

        if (!$role) {
            return $this->error('Role not found', 404);
        }

        $role->is_protected = in_array($role->name, $this->protectedRoles);

        return $this->success($role, 'Role retrieved successfully');
    }

    /**
     * Create a new role
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:125|unique:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        // Prevent creating roles with protected names
        if (in_array(strtolower($request->name), $this->protectedRoles)) {
            return $this->error('Cannot create role with protected name', 422);
        }

        try {
            DB::beginTransaction();

            $role = Role::create([
                'name' => $request->name,
                'guard_name' => 'web',
            ]);

            // Assign permissions if provided
            if ($request->has('permissions') && !empty($request->permissions)) {
                $permissions = Permission::whereIn('id', $request->permissions)->get();
                $role->syncPermissions($permissions);
            }

            DB::commit();

            $role->load('permissions:id,name');
            $role->is_protected = false;

            return $this->success($role, 'Role created successfully', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to create role: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Update a role
     */
    public function update(Request $request, $id)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->error('Role not found', 404);
        }

        // Check if role is protected
        if (in_array($role->name, $this->protectedRoles)) {
            // For protected roles, only allow permission updates, not name change
            if ($request->has('name') && $request->name !== $role->name) {
                return $this->error('Cannot rename protected role', 422);
            }
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:125|unique:roles,name,' . $id,
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        // Prevent renaming a *different* role to a protected name (name-collision squatting).
        // Must not fire when the name is unchanged — that's the normal case of just editing a
        // protected role's own permissions, since the edit form always resubmits its current name.
        if ($request->has('name') && $request->name !== $role->name && in_array(strtolower($request->name), $this->protectedRoles)) {
            return $this->error('Cannot rename to protected role name', 422);
        }

        try {
            DB::beginTransaction();

            // Update name only for non-protected roles
            if ($request->has('name') && !in_array($role->name, $this->protectedRoles)) {
                $role->name = $request->name;
                $role->save();
            }

            // Update permissions (allowed for all roles including protected)
            if ($request->has('permissions')) {
                $permissions = Permission::whereIn('id', $request->permissions)->get();
                $role->syncPermissions($permissions);
            }

            DB::commit();

            $role->load('permissions:id,name');
            $role->is_protected = in_array($role->name, $this->protectedRoles);

            return $this->success($role, 'Role updated successfully');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->error('Failed to update role: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Delete a role
     */
    public function destroy($id)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->error('Role not found', 404);
        }

        // Check if role is protected
        if (in_array($role->name, $this->protectedRoles)) {
            return $this->error('Cannot delete protected role', 422);
        }

        // Check if role has users
        if ($role->users()->count() > 0) {
            return $this->error('Cannot delete role with assigned users. Please reassign users first.', 422);
        }

        try {
            $role->delete();
            return $this->success(null, 'Role deleted successfully');
        } catch (\Exception $e) {
            return $this->error('Failed to delete role: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Assign role to user
     */
    public function assignToUser(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'role_id' => 'required|exists:roles,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $user = \App\Models\User::find($request->user_id);
        $role = Role::find($request->role_id);

        // Check if user already has this role
        if ($user->hasRole($role->name)) {
            return $this->error('User already has this role', 422);
        }

        $user->assignRole($role);

        return $this->success([
            'user_id' => $user->id,
            'user_name' => $user->name,
            'roles' => $user->roles->pluck('name'),
        ], 'Role assigned successfully');
    }

    /**
     * Remove role from user
     */
    public function removeFromUser(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'role_id' => 'required|exists:roles,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $user = \App\Models\User::find($request->user_id);
        $role = Role::find($request->role_id);

        // Check if user has this role
        if (!$user->hasRole($role->name)) {
            return $this->error('User does not have this role', 422);
        }

        // Prevent removing last role from user
        if ($user->roles->count() <= 1) {
            return $this->error('Cannot remove last role from user', 422);
        }

        $user->removeRole($role);

        return $this->success([
            'user_id' => $user->id,
            'user_name' => $user->name,
            'roles' => $user->roles->pluck('name'),
        ], 'Role removed successfully');
    }

    /**
     * Sync multiple roles to user (replace all roles)
     */
    public function syncUserRoles(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'role_ids' => 'required|array|min:1',
            'role_ids.*' => 'exists:roles,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $user = \App\Models\User::find($request->user_id);
        $roles = Role::whereIn('id', $request->role_ids)->get();

        $user->syncRoles($roles);

        return $this->success([
            'user_id' => $user->id,
            'user_name' => $user->name,
            'roles' => $user->roles->pluck('name'),
        ], 'User roles synced successfully');
    }

    /**
     * Get users by role
     */
    public function getUsersByRole($id, Request $request)
    {
        $role = Role::find($id);

        if (!$role) {
            return $this->error('Role not found', 404);
        }

        $query = \App\Models\User::role($role->name)->select('id', 'name', 'email', 'status', 'created_at');

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('email', 'like', '%' . $search . '%');
            });
        }

        $perPage = $request->get('per_page', 15);
        $users = $query->paginate($perPage);

        return $this->success($users, 'Users retrieved successfully');
    }
}
