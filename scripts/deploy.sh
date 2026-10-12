#!/bin/bash
# Deploy Kids Habit lên Mac Mini (Tailscale) — KHÔNG đụng data/ production
set -e
HOST="${KH_DEPLOY_HOST:?Cần set KH_DEPLOY_HOST (vd: your-mac-mini.local)}"
cd "$(dirname "$0")/.."
echo "▸ build…"; npm run build
echo "▸ rsync standalone…"
rsync -az --delete --exclude data/ .next/standalone/ "$HOST:kids-habit/"
rsync -az .next/static/ "$HOST:kids-habit/.next/static/"
rsync -az public/ "$HOST:kids-habit/public/"
echo "▸ restart service…"
ssh "$HOST" 'launchctl kickstart -k gui/$(id -u)/com.kids-habit.server; sleep 2; curl -s -m 5 http://localhost:3210/api/today -H "Cookie: kh_role=child" | head -c 120; echo'
echo "✓ Deploy xong — http://$HOST:3210"
