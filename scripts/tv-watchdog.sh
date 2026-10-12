#!/bin/bash
# L2 watchdog — TV-off fail-safe ĐỘC LẬP app (strategy-batch6 defenses, chạy trên Mac Mini)
# Mỗi 5 phút: thấy phiên đã cast TV (cast_atv_at) nhưng quá reward_ends_at + 15'
# mà tv_off_at vẫn trống → tự tắt TV. Chống kịch bản app chết/tab đóng → TV sáng mãi.
# (L1 = sweep trong app /api/pomodoro; L3 = ATV native Sleep After. 3 lớp độc lập.)
set -u
DB="$HOME/kids-habit/data/kids-habit.db"
CREDS="$HOME/kids-habit/data/atv-companion-creds"
ATVREMOTE="$HOME/pyatv-venv/bin/atvremote"
LOG="$HOME/kids-habit/data/home-automation.log"
APPLETV_IP="${KH_APPLETV_IP:?Cần set KH_APPLETV_IP}"

[ -f "$DB" ] || exit 0
command -v sqlite3 >/dev/null || exit 0

row=$(sqlite3 "$DB" "SELECT id FROM pomodoro_sessions
  WHERE status='running' AND cast_atv_at IS NOT NULL AND tv_off_at IS NULL
    AND reward_ends_at IS NOT NULL
    AND strftime('%s','now') > strftime('%s', reward_ends_at) + 900
  LIMIT 1;")
[ -n "$row" ] || exit 0

credc=$(cat "$CREDS" 2>/dev/null)
if [ -n "$credc" ] && [ -x "$ATVREMOTE" ]; then
  "$ATVREMOTE" -s "$APPLETV_IP" --companion-credentials "$credc" home >/dev/null 2>&1
  sleep 1
  "$ATVREMOTE" -s "$APPLETV_IP" --companion-credentials "$credc" turn_off >/dev/null 2>&1
  sqlite3 "$DB" "UPDATE pomodoro_sessions SET tv_off_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$row;"
  echo "$(date -u +%Y-%m-%dT%H:%M:%S.Z) L2-watchdog → TV home + sleep (phiên #$row quá 15' không ai tắt)" >> "$LOG"
fi
exit 0
