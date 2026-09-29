#!/usr/bin/env bash
# Kører migrationerne og RLS-testen mod en midlertidig lokal PostgreSQL.
# Kræver PostgreSQL (initdb, pg_ctl, psql) i PATH eller i /usr/lib/postgresql/*/bin.
set -euo pipefail

# PostgreSQL vil ikke køre som root (fx i en container), så skift til brugeren postgres.
if [ "$(id -u)" = 0 ]; then exec runuser -u postgres -- "$(realpath "$0")"; fi

cd "$(dirname "$0")/.."
PGBIN=$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")
DIR=$(mktemp -d)
PORT=54329
trap '"$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

"$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null

run() { psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

run -f supabase/tests/local_stub.sql 2>/dev/null
for f in supabase/migrations/*.sql; do run -f "$f"; done
run -o /dev/null -f supabase/tests/rls_test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
