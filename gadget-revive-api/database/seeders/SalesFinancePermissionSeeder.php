<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Service Intakes, Payments, Investors, and Notifications previously had no permission of their
 * own — Service Intakes/Payments piggybacked on the Orders trio and Investors on
 * manage_accounts/view_ledger, so they couldn't be granted (or the Permissions page couldn't
 * even show them as a distinct module) independently of those. Notifications had no permission
 * check at all.
 *
 * This only *adds* new permissions on top of the routes/sidebar gating that already exists (see
 * routes/api.php and Sidebar.tsx) — it never removes the old ones — so no existing role loses
 * access. Fully idempotent (firstOrCreate / additive givePermissionTo), safe to re-run.
 */
class SalesFinancePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $newPermissions = [
            'view_service_intakes', 'manage_service_intakes',
            'view_payments', 'manage_payments',
            'view_investors', 'manage_investors',
            'view_notifications',
        ];
        foreach ($newPermissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // Full-access tiers get everything, same as every other permission.
        foreach (['admin', 'super_admin'] as $tier) {
            $role = Role::where('name', $tier)->first();
            $role?->givePermissionTo($newPermissions);
        }

        // Every existing role gets view_notifications — it was ungated (visible to everyone) before,
        // so nobody should lose it just because it now has a name.
        Role::all()->each(fn (Role $role) => $role->givePermissionTo('view_notifications'));

        // Backfill the finer-grained permissions onto roles that already had the coarser ones
        // they were piggybacking on, so their menu access doesn't change.
        foreach (Role::with('permissions')->get() as $role) {
            $names = $role->permissions->pluck('name');

            if ($names->intersect(['view_orders', 'manage_orders', 'process_orders'])->isNotEmpty()) {
                $role->givePermissionTo(['view_service_intakes', 'manage_service_intakes', 'view_payments', 'manage_payments']);
            }

            if ($names->intersect(['manage_accounts', 'view_ledger'])->isNotEmpty()) {
                $role->givePermissionTo(['view_investors', 'manage_investors']);
            }
        }
    }
}
