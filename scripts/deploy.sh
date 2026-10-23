#!/usr/bin/env bash
# Run on the server to go live with the latest code on GitHub:
#   ssh root@145.79.13.134 /var/www/sri-company/scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  echo "Already up to date ($(git rev-parse --short HEAD))."
  exit 0
fi

changed=$(git diff --name-only HEAD origin/main)
git merge --ff-only --quiet origin/main
echo "$changed" | sed 's/^/  updated: /'

if echo "$changed" | grep -qE '^package(-lock)?\.json$'; then
  npm ci --omit=dev --no-audit --no-fund
fi

pm2 restart sri-company --update-env >/dev/null
port=$(grep -E '^PORT=' .env | cut -d= -f2)
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null "http://127.0.0.1:${port:-3002}/api/store"; then
    echo "Live: $(git log -1 --format='%h %s')"
    exit 0
  fi
  sleep 2
done
echo "App did not respond after restart. Check: pm2 logs sri-company" >&2
exit 1
