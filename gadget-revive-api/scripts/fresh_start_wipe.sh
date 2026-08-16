#!/usr/bin/env bash
#
# Gadget Revive — "fresh start" data wipe runbook.
#
# Backs up the FULL database, then permanently deletes all orders, cart,
# service-intake, payment-notice, accounting (chart of accounts, journal,
# expenses, investors/investments, suppliers, purchase orders, inventory
# logs), review, and audit-log data. Everything else — the product/service
# catalog, users, locations, CMS content, site settings, roles/permissions —
# is left untouched.
#
# USAGE (run this from the Laravel app's root directory, e.g. on the server
# inside /var/www/gadget-revive-api, so it can read the real .env there):
#
#   bash fresh_start_wipe.sh
#
# It will show you what's about to be deleted and require you to type an
# exact confirmation phrase before it does anything irreversible.

set -euo pipefail

APP_DIR="$(pwd)"
ENV_FILE="$APP_DIR/.env"
SQL_FILE="$(dirname "$0")/fresh_start_wipe.sql"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no .env found at $ENV_FILE — run this from the Laravel app's root directory." >&2
  exit 1
fi
if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERROR: fresh_start_wipe.sql not found next to this script." >&2
  exit 1
fi

env_var() {
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//'
}

DB_HOST="$(env_var DB_HOST)"
DB_PORT="$(env_var DB_PORT)"
DB_DATABASE="$(env_var DB_DATABASE)"
DB_USERNAME="$(env_var DB_USERNAME)"
DB_PASSWORD="$(env_var DB_PASSWORD)"

if [[ -z "$DB_DATABASE" || -z "$DB_USERNAME" ]]; then
  echo "ERROR: couldn't read DB_DATABASE/DB_USERNAME from $ENV_FILE." >&2
  exit 1
fi

export MYSQL_PWD="$DB_PASSWORD"
MYSQL_ARGS=(-h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USERNAME" "$DB_DATABASE")

WIPE_TABLES=(orders order_items carts cart_items service_intakes service_intake_items
  payment_notices journal_entry_lines journal_entries chart_of_accounts expenses
  expense_categories investments investors purchase_order_items purchase_orders
  suppliers inventory_logs reviews audit_logs)

echo "Database: $DB_DATABASE @ ${DB_HOST:-127.0.0.1}:${DB_PORT:-3306}"
echo
echo "Current row counts (these will all become 0):"
for t in "${WIPE_TABLES[@]}"; do
  count=$(mysql "${MYSQL_ARGS[@]}" -N -e "SELECT COUNT(*) FROM $t" 2>/dev/null || echo "?")
  printf "  %-24s %s\n" "$t" "$count"
done

echo
echo "Kept untouched: service_categories, services, product_categories, products,"
echo "product_brands, category_attributes, users, vendor_profiles, locations,"
echo "cms_pages, banners, faqs, site_settings, roles/permissions."
echo
read -r -p "Type EXACTLY   WIPE PRODUCTION DATA   to proceed: " CONFIRM
if [[ "$CONFIRM" != "WIPE PRODUCTION DATA" ]]; then
  echo "Confirmation text did not match — aborting, nothing was touched."
  exit 1
fi

BACKUP_DIR="$APP_DIR/storage/app/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre_wipe_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

echo
echo "Taking a full database backup to $BACKUP_FILE ..."
mysqldump -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USERNAME" "$DB_DATABASE" \
  --single-transaction --quick | gzip > "$BACKUP_FILE"
echo "Backup complete ($(du -h "$BACKUP_FILE" | cut -f1))."

echo
echo "Running the wipe..."
mysql "${MYSQL_ARGS[@]}" < "$SQL_FILE"
echo "Done."

echo
echo "Row counts after wipe (should all be 0):"
for t in "${WIPE_TABLES[@]}"; do
  count=$(mysql "${MYSQL_ARGS[@]}" -N -e "SELECT COUNT(*) FROM $t" 2>/dev/null || echo "?")
  printf "  %-24s %s\n" "$t" "$count"
done

echo
echo "If anything looks wrong, restore with:"
echo "  gunzip -c $BACKUP_FILE | mysql -h ${DB_HOST:-127.0.0.1} -P ${DB_PORT:-3306} -u $DB_USERNAME $DB_DATABASE"
