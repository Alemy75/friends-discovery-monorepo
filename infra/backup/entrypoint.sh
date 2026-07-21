#!/usr/bin/env bash
set -euo pipefail

# On-demand: `docker compose run --rm backup once`
if [ "${1:-}" = "once" ]; then
  exec /usr/local/bin/backup.sh
fi

# Scheduled: install a crontab and run crond in the foreground.
echo "${BACKUP_CRON} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] scheduled '${BACKUP_CRON}', retention ${BACKUP_RETENTION}"
exec crond -f -l 8
