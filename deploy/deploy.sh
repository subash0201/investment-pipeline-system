#!/usr/bin/env bash
# Build and (re)start IPTDS on the server. Safe to run on every update:
#   cd /var/www/iptds && git pull && sudo -u iptds bash deploy/deploy.sh && sudo systemctl restart iptds
# Run it as the app user (not root). Restart the service yourself afterwards (needs sudo).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$APP_DIR/backend"
FRONTEND="$APP_DIR/frontend"
PYTHON="${PYTHON:-python3}"

echo "==> IPTDS deploy in $APP_DIR"

if [[ ! -f "$BACKEND/.env" ]]; then
  echo "!! $BACKEND/.env is missing. Copy backend/.env.example to backend/.env and fill it in first." >&2
  exit 1
fi
if grep -qE '^DJANGO_DEBUG=1' "$BACKEND/.env"; then
  echo "!! DJANGO_DEBUG=1 in backend/.env — set it to 0 for production." >&2
  exit 1
fi

echo "==> Backend: virtualenv and packages"
[[ -d "$BACKEND/.venv" ]] || "$PYTHON" -m venv "$BACKEND/.venv"
"$BACKEND/.venv/bin/pip" install --quiet --upgrade pip
"$BACKEND/.venv/bin/pip" install --quiet -r "$BACKEND/requirements.txt"

cd "$BACKEND/investment_pipeline"
echo "==> Backend: checks, migrations, static files"
"$BACKEND/.venv/bin/python" manage.py check --deploy --fail-level ERROR
"$BACKEND/.venv/bin/python" manage.py migrate --noinput
"$BACKEND/.venv/bin/python" manage.py collectstatic --noinput --verbosity 0

echo "==> Frontend: install and build"
cd "$FRONTEND"
npm ci --no-audit --no-fund
npm run build

echo "==> Done. Now restart the API:  sudo systemctl restart iptds"
