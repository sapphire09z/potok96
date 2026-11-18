#!/usr/bin/env bash
# Actual full DB restore in an isolated temporary PostgreSQL 17 container.
# Does not connect to, or change, the live PostgreSQL instance.
set -euo pipefail
if [ "$#" -ne 1 ] || [[ ! "$1" =~ ^/opt/potok96-deploy/backups/[a-z0-9][a-z0-9-]{2,90}$ ]]; then
  echo 'Usage: bash scripts/verify-content-db-restore.sh /opt/potok96-deploy/backups/backup-...' >&2
  exit 2
fi
DIR="$1"
test -s "$DIR/database.dump"
test -s "$DIR/archive-manifest.json"
read -r PLAN_ID PLAN_SHA < <(python3 - "$DIR/archive-manifest.json" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as f:
    manifest = json.load(f)
a, b = manifest.get("planId"), manifest.get("planDigest")
if not isinstance(a, str) or not re.fullmatch(r"c[a-z0-9]{10,40}", a) or not isinstance(b, str) or not re.fullmatch(r"[0-9a-f]{64}", b):
    raise SystemExit("Invalid archive plan reference")
print(a, b)
PY
)
if [ -z "$PLAN_ID" ] || [ -z "$PLAN_SHA" ]; then
  echo 'Plan metadata missing' >&2
  exit 2
fi
# No network or exposed ports. Resource limits protect a small staging VPS.
docker run --rm --network none --cpus 1 --memory 1536m \
  -e EXPECTED_PLAN_ID="$PLAN_ID" -e EXPECTED_PLAN_SHA="$PLAN_SHA" \
  -v "$DIR:/archive:ro" --entrypoint bash postgres:17-bookworm -ceu '
  cp /archive/database.dump /tmp/database.dump
  chown postgres:postgres /tmp/database.dump
  mkdir -p /tmp/pg_restore_test
  chown postgres:postgres /tmp/pg_restore_test
  gosu postgres initdb -D /tmp/pg_restore_test -A trust >/dev/null
  gosu postgres pg_ctl -D /tmp/pg_restore_test -o "-c listen_addresses= -c unix_socket_directories=/tmp" -w start >/dev/null
  gosu postgres createdb -h /tmp test_restore
  gosu postgres pg_restore -h /tmp -d test_restore --exit-on-error --no-owner --no-acl /tmp/database.dump
  gosu postgres psql -h /tmp -d test_restore -Atc "SELECT id || chr(9) || digest FROM \"ContentPurgePlan\"" \
    | grep -Fx -- "${EXPECTED_PLAN_ID}$(printf "\t")${EXPECTED_PLAN_SHA}" >/dev/null || {
      echo "Restored plan/digest mismatch" >&2
      exit 1
    }
  gosu postgres pg_ctl -D /tmp/pg_restore_test -m fast -w stop >/dev/null
  echo "Isolated pg_restore succeeded, including requested plan digest. Production DB untouched."
'
