#!/usr/bin/env bash
#
# Gadget Revive — clear every cache layer on the live server after a data
# change (e.g. after running fresh_start_wipe.sh).
#
# Run the API part from /var/www/gadget-revive-api, and the two `pm2 restart`
# lines from wherever pm2 is available (they don't need a specific cwd).
#
# Why this is needed: the Laravel app itself doesn't cache query results
# anywhere (checked — no Cache::remember usage), so stale data after a DB
# change is almost certainly Next.js's in-memory fetch cache in the two
# `next start` processes (web + admin), which only clears on process restart.

set -euo pipefail

echo "== Laravel (API) framework caches =="
php artisan optimize:clear   # cache, config, route, view, compiled, events — all in one
echo "Done."

echo
echo "== PHP OPcache =="
echo "optimize:clear doesn't touch OPcache — restart php-fpm to flush compiled PHP:"
echo "  sudo systemctl restart php8.3-fpm"

echo
echo "== Next.js apps (web + admin) =="
echo "Restarting clears their in-memory fetch/data cache. If new code was also"
echo "deployed, rebuild first — a restart alone does NOT pick up new source:"
echo
echo "  cd /var/www/gadget-revive-web  && npm run build && pm2 restart gadget-revive-web"
echo "  cd /var/www/gadget-revive-admin && npm run build && pm2 restart gadget-revive-admin"
echo
echo "If no code changed and you only need the cache dropped:"
echo "  pm2 restart gadget-revive-web gadget-revive-admin"

echo
echo "== Browser / CDN =="
echo "Also hard-refresh (Ctrl/Cmd+Shift+R) when checking — a normal refresh can"
echo "still serve a browser-cached page."
