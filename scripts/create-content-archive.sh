#!/usr/bin/env bash
# Operator-only: full consistent pg_dump + S3 media of one active DRY RUN.
# Archive initially remains on VPS and MUST be exported encrypted to independent storage.
set -euo pipefail
umask 077
if [ "$#" -ne 1 ] || [[ ! "$1" =~ ^c[a-z0-9]{10,40}$ ]]; then
  echo 'Usage: bash scripts/create-content-archive.sh <ContentPurgePlan.id>' >&2
  exit 2
fi
cd /opt/potok96
PLAN="$1"
ROOT=/opt/potok96-deploy/backups
install -d -m 700 "$ROOT"
DIR="backup-${PLAN}-$(date -u +%Y%m%d%H%M%S)"
TARGET="$ROOT/$DIR"
install -d -m 700 "$TARGET"
printf 'Creating PostgreSQL dump at %s\n' "$TARGET"
# pg_dump is MVCC consistent within PostgreSQL. No mutating SQL is issued.
docker compose exec -T db pg_dump -U potok96 -d potok96 -Fc > "$TARGET/database.dump.partial"
test -s "$TARGET/database.dump.partial"
docker compose exec -T db pg_restore --list < "$TARGET/database.dump.partial" > /dev/null
mv "$TARGET/database.dump.partial" "$TARGET/database.dump"
# Build manual tool container separately from app and worker.
docker compose --profile tools build content-archive
docker compose --profile tools run --rm content-archive \
  node scripts/archive-content-purge.mjs --plan "$PLAN" --dir "$DIR"
docker compose --profile tools run --rm content-archive \
  node scripts/verify-content-archive.mjs --dir "$DIR"
printf '\nChecksum verification complete. NOW run isolated restore test:\n'
printf '  bash scripts/verify-content-db-restore.sh %s\n' "$TARGET"
printf 'Keep backup private; copy an ENCRYPTED copy to independent offsite storage.\n'
