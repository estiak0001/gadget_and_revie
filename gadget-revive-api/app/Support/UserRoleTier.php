<?php

namespace App\Support;

use App\Models\User;
use Spatie\Permission\Models\Role;

/**
 * A user has exactly ONE role at a time — no "additional roles" on top. Whatever role is
 * selected (a tier name like 'staff', or a custom role like 'Manager' created on the Roles page)
 * becomes the user's sole Spatie role, replacing anything they had before; that role's checked
 * permissions are the only thing that determines what they can do (see PermissionMiddleware /
 * the sidebar's permission map).
 *
 * Separately, `users.role` is a plain enum of 5 DB-level tiers — it is NOT a Spatie role and a
 * custom role name is never a valid value for it. It only exists so the coarse `role:admin,staff,
 * super_admin` route middleware (checked before any fine-grained permission) has something to
 * gate on without a DB join. Every place that changes a user's Spatie role MUST go through
 * syncSelectedRole() so this column stays in sync — a user whose Spatie role carries every
 * permission they need but whose `role` column was never updated to a tier the coarse gate
 * accepts is blocked from every /admin/* route before their permissions are even checked, which
 * looks indistinguishable from "the permission grant didn't work."
 */
class UserRoleTier
{
    /**
     * The 5 DB-level tiers — the only values the users.role enum column can actually hold.
     */
    public static function tierRoleNames(): array
    {
        return ['customer', 'vendor', 'staff', 'admin', 'super_admin'];
    }

    /**
     * A custom role (anything besides the 5 tiers) isn't a valid value for the users.role enum
     * column, so it's stored there as 'staff' — custom roles are always staff-tier for admin-panel
     * *access* purposes; the role name itself only drives *permissions* via Spatie.
     */
    public static function tierForRole(string $roleName): string
    {
        return in_array($roleName, self::tierRoleNames(), true) ? $roleName : 'staff';
    }

    /**
     * Makes $roleName the user's sole Spatie role (replacing any previous one) and keeps the
     * coarse `role` column in sync with it. The one function every role-change entry point
     * (user create/edit, and role assign/sync) must call — never call assignRole()/syncRoles()
     * directly on a User from a controller, or the two columns can drift apart.
     */
    public static function syncSelectedRole(User $user, string $roleName): void
    {
        if (!Role::where('name', $roleName)->exists()) {
            return;
        }

        $user->syncRoles([$roleName]);
        $user->role = self::tierForRole($roleName);
        $user->save();
    }
}
