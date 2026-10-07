<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Privilege-escalation guard for handing out permissions — directly on a role, or indirectly by
 * giving a user a role. An actor may only grant permissions they already hold themselves; without
 * this, anyone with manage_roles / assign_roles / create_users could mint a role with every
 * permission and assign it to themselves. super_admin is exempt because it holds everything.
 */
class PermissionGrant
{
    /**
     * Names of the permissions in $permissions that $actor does not hold. Empty = grant allowed.
     *
     * @param  Collection<int, \Spatie\Permission\Models\Permission>  $permissions
     * @return string[]
     */
    public static function missingFor(User $actor, Collection $permissions): array
    {
        if ($actor->hasRole('super_admin')) {
            return [];
        }

        $held = $actor->getAllPermissions()->pluck('name')->all();

        return $permissions->pluck('name')->diff($held)->values()->all();
    }

    /** Standard 403 message for a refused grant. */
    public static function message(array $missing): string
    {
        return 'You can only grant permissions you hold yourself. Missing: ' . implode(', ', $missing);
    }
}
