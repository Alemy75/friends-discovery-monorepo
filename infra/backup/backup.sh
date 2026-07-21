#!/usr/bin/env bash
set -euo pipefail

TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="friends-${PGDATABASE}-${TS}.sql.gz"
TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

mc alias set s3 "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" >/dev/null
echo "[backup] dumping ${PGDATABASE} -> ${TMP}"
pg_dump --no-owner --no-privileges | gzip -c > "${TMP}"

echo "[backup] verifying dump integrity"
if [ ! -s "${TMP}" ]; then
  echo "[backup] ERROR: dump is empty, aborting (nothing uploaded)" >&2
  exit 1
fi
if ! gzip -t "${TMP}"; then
  echo "[backup] ERROR: dump failed gzip integrity check, aborting (nothing uploaded)" >&2
  exit 1
fi

echo "[backup] uploading ${TMP} -> s3/${S3_BUCKET}/backups/${FILE}"
mc pipe "s3/${S3_BUCKET}/backups/${FILE}" < "${TMP}"
echo "[backup] upload complete"

# Retention: keep the newest ${BACKUP_RETENTION} dumps, delete the rest.
mc ls "s3/${S3_BUCKET}/backups/" | awk '{print $NF}' | grep '\.sql\.gz$' | sort -r \
  | tail -n +"$((BACKUP_RETENTION + 1))" \
  | while read -r old; do
      echo "[backup] pruning ${old}"
      mc rm "s3/${S3_BUCKET}/backups/${old}"
    done
