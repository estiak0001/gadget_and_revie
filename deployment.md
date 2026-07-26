# Gadget Revive — Deployment Guide

This reflects the **actual live server**, verified by logging into
`72.61.227.247` directly (not just inferred from repo config files). Everything
under "Current live state" below is confirmed as of this writing; everything
under "Provisioning a server from scratch" is the from-scratch procedure for
rebuilding on a new box if this one is ever replaced.

---

## 0. Current live state (verified on the server)

**Server**: `72.61.227.247`, hostname `srv1133756`, Ubuntu 24.04.3 LTS, kernel 6.8.
Root SSH access.

**Software installed**: Nginx 1.24.0, PHP 8.3.6, MySQL 8.0.46, Node v20.20.0, PM2 6.0.14.

**The real domain is `gadgetandrevive.com`** — not `gadgetrevivebd.com`.
Confirmed from the live `.env.production` / `ecosystem.config.js` on the
server and from Laravel's own `.env` (`APP_URL`, `SANCTUM_STATEFUL_DOMAINS`):

| App | Domain | Port | Process manager |
|---|---|---|---|
| Storefront (`gadget-revive-web`) | `gadgetandrevive.com`, `www.` | 3000 | PM2, cluster mode |
| Admin panel (`gadget-revive-admin`) | `admin.gadgetandrevive.com` | 3001 | PM2, cluster mode |
| API (`gadget-revive-api`) | `api.gadgetandrevive.com` | PHP-FPM via unix socket `/var/run/php/php8.3-fpm.sock` | php8.3-fpm |

All three have valid Let's Encrypt certificates (one cert covering
`gadgetandrevive.com`, `www.`, `admin.`, `api.`) with HTTP→HTTPS redirects
already configured by Certbot.

```
$ pm2 list
┌────┬─────────────────────┬─────────┬─────────┬────────┐
│ id │ name                │ version │ mode    │ status │
├────┼─────────────────────┼─────────┼─────────┼────────┤
│ 0  │ gadget-revive-admin │ 16.1.6  │ cluster │ online │
│ 1  │ gadget-revive-web   │ 15.5.9  │ cluster │ online │
└────┴─────────────────────┴─────────┴─────────┴────────┘
```

Code lives at:
- `/var/www/gadget-revive-admin` (owned by `root`)
- `/var/www/gadget-revive-web` (owned by `root`)
- `/var/www/gadget-revive-api` (owned by `www-data`)

### ⚠️ Things found during this check that need attention

1. **No queue worker is running.** `gadget-revive-api/.env` sets
   `QUEUE_CONNECTION=database`, but there is no systemd service (or PM2
   process, or anything) running `php artisan queue:work` on the server. Any
   queued job (notifications, ledger sync, etc.) is silently piling up in the
   `jobs` table and never executing. Fix in §4 below.
2. **No crontab exists at all** — `crontab -l` for both `root` and `www-data`
   returns "no crontab". If `app/Console/Kernel.php` schedules anything
   (token cleanup, recurring reports, etc.), it has never run in production.
   Fix in §4 below.
3. **`gadgetrevivebd.com` is dead leftover config**, not actively harmful.
   Nginx has enabled sites (and its own separate Let's Encrypt cert) for
   `gadgetrevivebd.com` / `admin.` / `api.`, proxying to the same ports 3000
   and 3001 as the real domain. Nothing in public DNS points to this domain
   (`gadgetrevivebd.com` doesn't resolve at all), so it's inert — but it's
   also why the `gadget-revive-admin` repo's own `next.config.js`
   (`images.remotePatterns`) and `.env.example` still reference it. Either
   finish migrating away from it (remove the nginx sites + cert, fix the
   repo's `next.config.js`/`.env.example` to reference `gadgetandrevive.com`)
   or leave it as-is if you plan to bring that domain back — just don't trust
   the repo's `.env.example`/`next.config.js` as the source of truth for the
   API domain; the deployed `.env.production` files are correct.
4. **phpMyAdmin is exposed on `http://72.61.227.247:8080`** (plain HTTP, by
   IP, not behind the domain or Nginx TLS, no IP allowlist). It's protected
   only by its own login form. Recommended: put it behind Nginx with TLS and
   an IP allowlist, or take it down if unused — see §7.
5. Both PM2 processes run as **`root`**, not `www-data`. Works, but if you
   ever harden this box, running Node processes as a lower-privilege user is
   preferable. Not urgent, just noted.

---

## 1. Deploying an update (the day-to-day operation)

**API:**
```bash
ssh root@72.61.227.247
cd /var/www/gadget-revive-api
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

**Admin panel:**
```bash
cd /var/www/gadget-revive-admin
git pull
npm install
npm run build
pm2 restart gadget-revive-admin
```

**Storefront:**
```bash
cd /var/www/gadget-revive-web
git pull
npm install
npm run build
pm2 restart gadget-revive-web
```

Health check after any deploy:
```bash
curl -sI https://api.gadgetandrevive.com/api/products | head -1   # expect 200
curl -sI https://admin.gadgetandrevive.com | head -1              # expect 200
curl -sI https://gadgetandrevive.com | head -1                    # expect 200
pm2 status
tail -50 /var/www/gadget-revive-api/storage/logs/laravel.log
```

---

## 2. Fixing the two gaps found in §0

**Queue worker** — add a systemd service so queued jobs actually run and
survive reboots:

```ini
# /etc/systemd/system/gadget-queue.service
[Unit]
Description=Gadget Revive queue worker
After=network.target mysql.service

[Service]
User=www-data
WorkingDirectory=/var/www/gadget-revive-api
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now gadget-queue
systemctl status gadget-queue
```

**Scheduler** — add the standard Laravel cron entry (safe to add even if
`Kernel.php` currently schedules nothing — it's a no-op until something is
registered there):

```bash
crontab -u www-data -e
# add this line:
* * * * * cd /var/www/gadget-revive-api && php artisan schedule:run >> /dev/null 2>&1
```

---

## 3. Nginx configs actually deployed (for reference)

`gadgetandrevive.com` (storefront) and `admin.gadgetandrevive.com` are plain
reverse proxies to their PM2 ports; `api.gadgetandrevive.com` serves the
Laravel `public/` directly through PHP-FPM. All three exist as
`/etc/nginx/sites-available/<domain>` symlinked into `sites-enabled/`, each
with a Certbot-managed 80→443 redirect block above the real `listen 443 ssl`
block shown below.

```nginx
# /etc/nginx/sites-available/gadgetandrevive.com
server {
    server_name gadgetandrevive.com www.gadgetandrevive.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/gadgetandrevive.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gadgetandrevive.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

```nginx
# /etc/nginx/sites-available/admin.gadgetandrevive.com
server {
    server_name admin.gadgetandrevive.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/gadgetandrevive.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gadgetandrevive.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

```nginx
# /etc/nginx/sites-available/api.gadgetandrevive.com
server {
    server_name api.gadgetandrevive.com;
    root /var/www/gadget-revive-api/public;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    index index.php;
    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }
    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }
    location ~ /\. { deny all; }

    client_max_body_size 50M;

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/gadgetandrevive.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gadgetandrevive.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

Certificates auto-renew via the `certbot.timer` systemd unit
(`systemctl list-timers | grep certbot`).

---

## 4. phpMyAdmin (installed, needs hardening)

Currently reachable at `http://72.61.227.247:8080` — plain HTTP, no domain,
no IP restriction, config at `/etc/nginx/sites-available/phpmyadmin`
(`listen 8080; server_name 72.61.227.247;`). At minimum, restrict by source IP:

```nginx
# add inside the phpmyadmin server block
allow <your-office-or-home-ip>;
deny all;
```

Better: move it behind a real subdomain with TLS (e.g.
`db-admin.gadgetandrevive.com`) and keep the IP allowlist, or tear it down if
nobody actually uses it — direct `mysql -u gadget_user -p` over an SSH
session covers the same need with a smaller attack surface.

---

## 5. Provisioning a server from scratch

Only needed if this server is ever replaced. Package versions match what's
actually installed on `72.61.227.247` today.

```bash
apt update && apt upgrade -y

# PHP 8.3 + extensions Laravel needs
apt install -y software-properties-common
add-apt-repository ppa:ondrej/php -y
apt update
apt install -y php8.3 php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-gd php8.3-intl

# Composer
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

# MySQL 8
apt install -y mysql-server
mysql_secure_installation

# Node.js 20 LTS (the admin app is Next.js 16 and requires it)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx git
```

```bash
mkdir -p /var/www && cd /var/www
git clone git@github.com:shawon9324/gadget-revive-api.git
git clone git@github.com:shawon9324/gadget-revive-admin.git
git clone git@github.com:shawon9324/gadget-revive-web.git
```

**Database:**
```sql
CREATE DATABASE gadget_revive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gadget_user'@'127.0.0.1' IDENTIFIED BY '<strong password>';
GRANT ALL PRIVILEGES ON gadget_revive.* TO 'gadget_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

**API** (`/var/www/gadget-revive-api`):
```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```
Set in `.env`: `APP_ENV=production`, `APP_DEBUG=false`,
`APP_URL=https://api.gadgetandrevive.com`, the DB credentials above,
`SANCTUM_STATEFUL_DOMAINS=admin.gadgetandrevive.com`,
`QUEUE_CONNECTION=database`, `CACHE_STORE=database`. Then:
```bash
php artisan migrate --force
php artisan db:seed --force      # first deploy only
php artisan storage:link
chown -R www-data:www-data /var/www/gadget-revive-api
chmod -R 775 storage bootstrap/cache
```
Then set up the queue worker + cron from §2.

**Admin** (`/var/www/gadget-revive-admin`):
```bash
node -v   # must print v20+
npm install
```
Set `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://api.gadgetandrevive.com/api
NEXT_PUBLIC_WEB_URL=https://gadgetandrevive.com
```
```bash
npm run build
pm2 start ecosystem.config.js   # already committed, runs `next start -p 3001`
pm2 save
```

**Web** (`/var/www/gadget-revive-web`):
```bash
npm install
```
Set `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://api.gadgetandrevive.com/api
NEXT_PUBLIC_SITE_URL=https://gadgetandrevive.com
```
```bash
npm run build
pm2 start ecosystem.config.js   # runs `next start -p 3000`
pm2 save
pm2 startup systemd             # once — run the printed command, then `pm2 save` again
```

**Nginx + SSL**: use the three server blocks from §3 (swap in your real
domain), symlink into `sites-enabled`, then:
```bash
nginx -t && systemctl reload nginx
certbot --nginx -d gadgetandrevive.com -d www.gadgetandrevive.com
certbot --nginx -d admin.gadgetandrevive.com
certbot --nginx -d api.gadgetandrevive.com
```
DNS A records for the bare domain, `www`, `admin`, and `api` must already
point at the server's IP before running certbot, or the HTTP-01 challenge
fails.

**Firewall:**
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```
Leave MySQL 3306 closed to the outside world — the app only ever talks to it
over `127.0.0.1`.

---

## Notes

- **Node version**: the admin app (Next.js 16) will not build on Node 18 —
  always confirm `node -v` is 20+ first.
- Both `next.config.js` files list `localhost`/`127.0.0.1` in
  `allowedDevOrigins`/`remotePatterns` — harmless in production, needed for
  anyone developing locally against the same config, don't strip them.
