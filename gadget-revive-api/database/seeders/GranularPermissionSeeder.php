<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Splits every module's previously all-or-nothing coarse permission bucket (e.g. `manage_orders`
 * gating list/create/edit/refund/record-payment/correct-payment all at once) into one permission
 * per distinct action, so a role can be granted exactly the actions it needs. Every route keeps
 * its old coarse permission(s) as valid alongside the new specific one — see routes/api.php — so
 * this is additive by construction wherever the old permission was a general business term
 * (view_x/manage_x/process_x) rather than a literal single-action name.
 *
 * Two real exceptions, backfilled explicitly below because the old names WERE already
 * single-action-shaped (create_products/edit_products/delete_products, view_notifications) but
 * previously worked as skeleton keys for the whole module due to route-group bundling — closing
 * that gap is the entire point of this change, but every role currently relying on the bundled
 * behavior needs the newly-required permission backfilled so it doesn't silently lose access:
 * - Any role that can create/edit/delete/manage products or services also needs `view_products`/
 *   `view_services` — otherwise they'd keep the ability to edit but lose the ability to even see
 *   the list they're editing.
 * - Any role holding `view_notifications` also gets `manage_notifications` — that permission
 *   alone already covers mark-read/delete today; only NEW roles created going forward get the
 *   option of a genuinely read-only notifications grant.
 *
 * Fully idempotent (firstOrCreate / additive givePermissionTo), safe to re-run.
 */
class GranularPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $newPermissions = [
            // Users
            'create_users', 'edit_users', 'delete_users', 'update_user_status', 'reset_user_password',
            // Vendors
            'reject_vendors', 'suspend_vendors',
            // Orders
            'refund_orders', 'correct_payment_amounts', 'create_custom_invoices', 'amend_paid_orders',
            // Service Intakes
            'convert_service_intakes', 'confirm_service_intake_price',
            // Categories
            'view_categories', 'reorder_categories',
            // Content (CMS)
            'manage_branch_locations', 'manage_contact_inquiries', 'manage_cms_pages',
            // Locations
            'manage_divisions', 'manage_districts', 'manage_areas',
            // Tickets
            'reply_tickets', 'assign_tickets', 'close_tickets', 'delete_tickets',
            // Reviews
            'moderate_reviews', 'delete_reviews',
            // Settings
            'regenerate_api_keys',
            // Products
            'view_products', 'toggle_product_status', 'toggle_product_featured',
            // Services
            'view_services', 'toggle_service_status',
            // Notifications
            'manage_notifications',
            // Reports
            'view_sales_reports', 'view_vendor_reports', 'view_customer_reports',
            'view_catalog_reports', 'view_review_reports', 'view_ticket_reports',
            // Expenses
            'view_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses',
            // Purchases
            'mark_purchase_orders', 'receive_purchase_orders', 'pay_purchase_orders', 'cancel_purchase_orders',
            'correct_purchase_receipts', 'view_purchase_history',
            // Investors
            'process_investor_returns',
            // Accounts & Finance
            'view_financial_statements', 'manage_chart_of_accounts', 'post_journal_entries',
            'process_pending_ledger_items',
            // Roles & Permissions
            'manage_role_definitions', 'assign_roles',
        ];

        foreach ($newPermissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // Full-access tiers get everything, same as every other permission in this system.
        foreach (['admin', 'super_admin'] as $tier) {
            Role::where('name', $tier)->first()?->givePermissionTo($newPermissions);
        }

        foreach (Role::with('permissions')->get() as $role) {
            $names = $role->permissions->pluck('name');

            if ($names->intersect(['manage_products', 'create_products', 'edit_products', 'delete_products', 'manage_inventory'])->isNotEmpty()) {
                $role->givePermissionTo('view_products');
            }
            if ($names->intersect(['manage_services', 'create_services', 'edit_services', 'delete_services'])->isNotEmpty()) {
                $role->givePermissionTo('view_services');
            }
            if ($names->contains('manage_categories')) {
                $role->givePermissionTo('view_categories');
            }
            if ($names->contains('view_notifications')) {
                $role->givePermissionTo('manage_notifications');
            }
        }
    }
}
