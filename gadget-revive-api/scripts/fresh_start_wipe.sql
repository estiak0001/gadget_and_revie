-- Gadget Revive — "fresh start" data wipe
--
-- Removes ALL orders/transactions/accounting/reviews/audit history.
-- KEEPS: service_categories, services, product_categories, products (and their
-- brands/attributes), users/vendor_profiles, locations, CMS content, site
-- settings, roles/permissions.
--
-- This is IRREVERSIBLE. Do not run this without a fresh backup taken first —
-- see fresh_start_wipe.sh, which takes that backup automatically before
-- calling this file.

SET FOREIGN_KEY_CHECKS = 0;

-- Orders & order items (includes carts and repair service-intake records)
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE cart_items;
TRUNCATE TABLE carts;
TRUNCATE TABLE service_intake_items;
TRUNCATE TABLE service_intakes;

-- Payments & invoices (orders carries payment/paid_amount/refund columns
-- directly — invoices are generated on the fly from order data, no table of
-- their own)
TRUNCATE TABLE payment_notices;

-- Accounting module
TRUNCATE TABLE journal_entry_lines;
TRUNCATE TABLE journal_entries;
TRUNCATE TABLE chart_of_accounts;
TRUNCATE TABLE expenses;
TRUNCATE TABLE expense_categories;
TRUNCATE TABLE investments;
TRUNCATE TABLE investors;
TRUNCATE TABLE purchase_order_items;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE inventory_logs; -- stock-movement log tied to orders/purchase orders

-- Reviews & audit logs
TRUNCATE TABLE reviews;
TRUNCATE TABLE audit_logs;

SET FOREIGN_KEY_CHECKS = 1;
