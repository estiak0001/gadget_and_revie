#!/usr/bin/env bash
# Git-based deploy, run ON THE SERVER as root.
#
#   gadget-deploy              deploy apps whose files changed since the last deploy
#   gadget-deploy --all        redeploy every app regardless
#   gadget-deploy api web      redeploy only the named apps (api | admin | web)
#
# Pulls the monorepo into $REPO, then syncs each app into its /var/www dir.
# Server-only files (.env*, storage/, node_modules/, vendor/, .next/) are never touched.
set -euo pipefail

REPO=${REPO:-/srv/gadget-revive}
BRANCH=${BRANCH:-main}
WWW=${WWW:-/var/www}
STATE=$WWW/.deployed_sha

log() { printf '\n==> %s\n' "$*"; }

exec 9>/var/lock/gadget-deploy.lock
flock -n 9 || { echo "another deploy is running"; exit 1; }

git -C "$REPO" fetch --quiet origin "$BRANCH"
NEW=$(git -C "$REPO" rev-parse "origin/$BRANCH")
OLD=$(cat "$STATE" 2>/dev/null || true)
git -C "$REPO" reset --hard --quiet "$NEW"

# Which apps to deploy
want=()
if [[ ${1:-} == --all || -z $OLD ]]; then
  want=(api admin web)
elif [[ $# -gt 0 ]]; then
  want=("$@")
else
  [[ $OLD == "$NEW" ]] && { echo "already at ${NEW:0:7}, nothing to do"; exit 0; }
  changed=$(git -C "$REPO" diff --name-only "$OLD" "$NEW")
  for app in api admin web; do
    grep -q "^gadget-revive-$app/" <<<"$changed" && want+=("$app")
  done
fi
[[ ${#want[@]} -eq 0 ]] && { echo "no app changes between ${OLD:0:7} and ${NEW:0:7}"; echo "$NEW" >"$STATE"; exit 0; }

# True if $1 (path inside the repo) changed between OLD and NEW, or there is no baseline
changed_since() { [[ -z $OLD ]] || ! git -C "$REPO" diff --quiet "$OLD" "$NEW" -- "$1"; }

deploy_api() {
  local src=$REPO/gadget-revive-api/ dst=$WWW/gadget-revive-api/
  local ex=(--exclude=.env --exclude='.env.*' --exclude=/storage/ --exclude=/vendor/
            --exclude=/node_modules/ --exclude=/bootstrap/cache/ --exclude=/public/storage
            --exclude=/scraper/.venv/ --exclude=/scraper/output/)
  log "api: migrations first (new code must not run before its schema)"
  rsync -a "$src/database/migrations/" "$dst/database/migrations/"
  (cd "$dst" && sudo -u www-data php artisan migrate --force)

  log "api: sync code"
  rsync -a "${ex[@]}" "$src" "$dst"
  if changed_since gadget-revive-api/composer.lock; then
    (cd "$dst" && sudo -u www-data composer install --no-dev --optimize-autoloader --no-interaction)
  fi
  chown -R www-data:www-data "$dst" 2>/dev/null || true
  (cd "$dst" && sudo -u www-data php artisan config:cache \
              && sudo -u www-data php artisan route:cache \
              && sudo -u www-data php artisan view:cache)
  systemctl reload php8.3-fpm
  systemctl is-enabled gadget-queue >/dev/null 2>&1 && systemctl restart gadget-queue || true
}

deploy_next() {  # $1 = admin | web
  local app=gadget-revive-$1 src=$REPO/gadget-revive-$1/ dst=$WWW/gadget-revive-$1/
  log "$1: sync code"
  rsync -a --delete --exclude=.env --exclude='.env.*' --exclude=/node_modules/ --exclude=/.next/ "$src" "$dst"
  cd "$dst"
  # package-lock.json is gitignored, so key off package.json
  if changed_since "$app/package.json" || [[ ! -d node_modules ]]; then npm install --no-audit --no-fund; fi
  log "$1: build (clearing .next/cache so stale ISR entries can't reference old chunks)"
  rm -rf .next/cache
  npm run build
  pm2 restart "$app" --update-env
}

for app in "${want[@]}"; do
  case $app in
    api) deploy_api ;;
    admin|web) deploy_next "$app" ;;
    *) echo "unknown app: $app"; exit 1 ;;
  esac
done

echo "$NEW" >"$STATE"

log "health check"
check() { printf '%-45s %s\n' "$1" "$(curl -s -o /dev/null -w '%{http_code}' "$1")"; }
check https://api.gadgetandrevive.com/api/products
check https://admin.gadgetandrevive.com
check https://gadgetandrevive.com
echo "web cache header: $(curl -sI https://gadgetandrevive.com | grep -i x-nextjs-cache || echo none)  (must not be STALE)"
log "deployed ${NEW:0:7}: ${want[*]}"
