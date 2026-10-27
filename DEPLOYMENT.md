# Deploying IPTDS

A single Linux server (VPS) runs everything:

```
Browser ──HTTPS──► Nginx ──┬── /            React app (frontend/dist, static files)
                           ├── /assets/     React build files (cached for a year)
                           ├── /api/        ─► Gunicorn :8001 ─► Django ─► PostgreSQL
                           ├── /django-admin/ ─► Gunicorn (Django's own admin site)
                           └── /static/     Django admin CSS/JS (collectstatic)
```

The React app and the API share one domain, so there is no CORS to configure.
The steps assume **Ubuntu 24.04**, the app in **/var/www/iptds**, a system user **iptds**
and the domain **iptds.example.com** — replace them with yours everywhere.

> Requirements: Python **3.12+** (Django 6.1), Node **18+** (20 LTS recommended), PostgreSQL **14+**.

---

## 1. Server packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip postgresql nginx git certbot python3-certbot-nginx ufw
# Node 20 LTS (if `node -v` is older than 18):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 2. Database

Use a dedicated database user, not `postgres`:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER iptds WITH PASSWORD 'choose-a-long-random-password';
CREATE DATABASE iptds OWNER iptds;
SQL
```

## 3. Code

```bash
sudo adduser --system --group --home /var/www/iptds --shell /bin/bash iptds
sudo usermod -aG www-data iptds
sudo -u iptds git clone https://github.com/<you>/investment-pipeline-system.git /var/www/iptds
```

## 4. Settings — `backend/.env`

```bash
cd /var/www/iptds
sudo -u iptds cp backend/.env.example backend/.env
sudo -u iptds nano backend/.env
sudo chmod 600 backend/.env
```

Set at least:

```ini
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<python3 -c "import secrets; print(secrets.token_urlsafe(50))">
DJANGO_ALLOWED_HOSTS=iptds.example.com
CSRF_TRUSTED_ORIGINS=https://iptds.example.com
POSTGRES_DB=iptds
POSTGRES_USER=iptds
POSTGRES_PASSWORD=<the password from step 2>
POSTGRES_HOST=localhost
```

`backend/.env` is in `.gitignore` — never commit it.

## 5. Build

```bash
cd /var/www/iptds
sudo -u iptds bash deploy/deploy.sh
```

This creates `backend/.venv`, installs the pinned packages (including Gunicorn), runs
`check --deploy`, applies migrations (which also create the 11 communities), collects static
files and builds the React app into `frontend/dist/`. It refuses to run with `DJANGO_DEBUG=1`.

Create the first administrator (do **not** run `seed_demo` on a real server — it creates demo
accounts with a published password):

```bash
cd /var/www/iptds/backend/investment_pipeline
sudo -u iptds ../.venv/bin/python manage.py createsuperuser
```

## 6. Gunicorn service

```bash
sudo cp /var/www/iptds/deploy/systemd/iptds.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now iptds
sudo systemctl status iptds          # should be "active (running)"
curl -s http://127.0.0.1:8001/api/health/   # {"status":"ok"}
```

Logs: `journalctl -u iptds -f`. Workers/port can be tuned in `deploy/gunicorn.conf.py`.

## 7. Nginx and HTTPS

```bash
sudo cp /var/www/iptds/deploy/nginx/iptds.conf /etc/nginx/sites-available/iptds.conf
sudo nano /etc/nginx/sites-available/iptds.conf      # set server_name
sudo ln -s /etc/nginx/sites-available/iptds.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d iptds.example.com             # HTTPS + automatic renewal
```

Nginx must be able to read `frontend/dist` and `backend/investment_pipeline/staticfiles`
(the default 755 folder permissions are enough).

## 8. Load the portfolio catalogues

The prototype's 886 portfolios (SDG Intervention, SDG Indicator, Climate NAP 2021–2050,
Digital/AI Sovereign, Draft) are imported from JSON or CSV exports:

```bash
cd /var/www/iptds/backend/investment_pipeline
sudo -u iptds ../.venv/bin/python manage.py import_portfolios /path/to/sdg_interventions.json \
    --collection sdg_intervention --unit billion --dry-run      # check first
sudo -u iptds ../.venv/bin/python manage.py import_portfolios /path/to/sdg_interventions.json \
    --collection sdg_intervention --unit billion
```

The accepted fields are listed at the top of `core/management/commands/import_portfolios.py`.
Re-importing a file updates portfolios with the same `reference` instead of duplicating them.

## 9. Backups

```bash
sudo -u iptds mkdir -p /var/www/iptds/backups
sudo -u iptds crontab -e
# add:
30 2 * * * /var/www/iptds/deploy/backup.sh >> /var/www/iptds/backups/backup.log 2>&1
```

Keeps 14 days of compressed `pg_dump` files. Copy them off the server as well.
Restore: `gunzip -c backups/iptds-YYYYmmdd-HHMM.sql.gz | psql -h localhost -U iptds iptds`.

## 10. Check it works

- `https://iptds.example.com/` — the network landing page loads without signing in.
- `https://iptds.example.com/django-admin/` — Django admin login (styled; if not, re-run collectstatic).
- Join as a new member, like and comment on a portfolio, join a community, send a service request.
- Sign in as the administrator → `/admin` workspace; the service request appears under *Investment services*.
- Reload a deep link such as `/portfolios/1` — it must not 404 (Nginx `try_files`).
- `http://` redirects to `https://`.

Once HTTPS is confirmed, raise `DJANGO_HSTS_SECONDS` to `31536000` in `backend/.env` and restart.

## Updating

```bash
cd /var/www/iptds
sudo -u iptds git pull
sudo -u iptds bash deploy/deploy.sh
sudo systemctl restart iptds
```

## Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `systemctl status iptds`, `journalctl -u iptds -n 50` |
| 400 Bad Request | `DJANGO_ALLOWED_HOSTS` must contain the domain |
| Django admin login fails with CSRF error | `CSRF_TRUSTED_ORIGINS=https://your-domain` |
| Redirect loop | Nginx must send `X-Forwarded-Proto` (it does in `deploy/nginx/iptds.conf`) |
| `ImproperlyConfigured: Set DJANGO_SECRET_KEY` | `backend/.env` is missing the key, or not readable by `iptds` |
| Admin pages unstyled | `manage.py collectstatic` and the `/static/` alias path in Nginx |
| "Too many requests" on login | Rate limit: 10/min per IP (`THROTTLE_LOGIN` in `.env`) |

`check --deploy` reports two optional warnings (`SECURE_HSTS_INCLUDE_SUBDOMAINS`,
`SECURE_HSTS_PRELOAD`). Enable them only if **every** subdomain of your domain is HTTPS-only.
