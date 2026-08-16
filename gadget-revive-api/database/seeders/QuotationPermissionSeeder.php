<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Quotations is a brand-new standalone module (see routes/api.php's quotations group) — nothing
 * to backfill from a coarser existing permission the way SalesFinancePermissionSeeder does,
 * since no route ever gated it under anything else. super_admin already gets every permission
 * automatically; this only needs to additionally reach the 'admin' tier so existing admin users
 * see the module with no manual role reconfiguration.
 */
class QuotationPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = ['view_quotations', 'manage_quotations'];
        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach (['admin', 'super_admin'] as $tier) {
            $role = Role::where('name', $tier)->first();
            $role?->givePermissionTo($permissions);
        }
    }
}
