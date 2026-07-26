<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Adds the 'staff' and 'super_admin' tiers on top of the original RoleSeeder, which isn't safely
 * re-runnable (uses Role::create/Permission::create directly). Everything here is idempotent
 * (firstOrCreate) so it's safe to run again on an environment that already has it applied.
 */
class AdminTierSeeder extends Seeder
{
    public function run(): void
    {
        Permission::firstOrCreate(['name' => 'manage_roles', 'guard_name' => 'web']);

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->givePermissionTo('manage_roles');

        $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => 'web']);
        $staff->syncPermissions([
            'view_orders', 'manage_orders', 'process_orders',
            'create_products', 'edit_products', 'manage_inventory',
            'create_services', 'edit_services',
            'respond_reviews', 'respond_tickets',
            'view_vendors', 'view_reports',
        ]);

        $superAdmin = Role::firstOrCreate(['name' => 'super_admin', 'guard_name' => 'web']);
        $superAdmin->givePermissionTo(Permission::all());
    }
}
