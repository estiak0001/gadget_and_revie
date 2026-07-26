<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create roles
        $admin = Role::create(['name' => 'admin', 'guard_name' => 'web']);
        $vendor = Role::create(['name' => 'vendor', 'guard_name' => 'web']);
        $customer = Role::create(['name' => 'customer', 'guard_name' => 'web']);

        // Create permissions
        $permissions = [
            // User Management
            'manage_users',
            'view_users',

            // Vendor Management
            'manage_vendors',
            'approve_vendors',
            'view_vendors',

            // Category Management
            'manage_categories',

            // Location Management
            'manage_locations',

            // Service Management
            'manage_services',
            'create_services',
            'edit_services',
            'delete_services',

            // Product Management
            'manage_products',
            'create_products',
            'edit_products',
            'delete_products',
            'manage_inventory',

            // Order Management
            'manage_orders',
            'view_orders',
            'process_orders',

            // Review Management
            'manage_reviews',
            'respond_reviews',

            // Ticket Management
            'manage_tickets',
            'respond_tickets',

            // CMS Management
            'manage_cms',
            'manage_banners',
            'manage_faqs',
            'manage_settings',

            // Report Access
            'view_reports',
            'export_reports',

            // Audit Logs
            'view_audit_logs',

            // Purchase Management
            'manage_purchases',
            'view_purchases',
            'manage_suppliers',

            // Accounting
            'manage_accounts',
            'view_ledger',
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission, 'guard_name' => 'web']);
        }

        // Assign permissions to roles
        $admin->givePermissionTo(Permission::all());

        $vendor->givePermissionTo([
            'create_services',
            'edit_services',
            'delete_services',
            'create_products',
            'edit_products',
            'delete_products',
            'manage_inventory',
            'view_orders',
            'process_orders',
            'respond_reviews',
            'respond_tickets',
            'view_reports',
        ]);

        $customer->givePermissionTo([
            'view_vendors',
        ]);
    }
}
