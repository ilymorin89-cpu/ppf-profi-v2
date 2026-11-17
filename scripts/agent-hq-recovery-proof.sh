#!/usr/bin/env bash
set -euo pipefail

# Disposable-CI-only recovery proof. Never point ADMIN_URL at a production cluster.
: "${ADMIN_URL:?ADMIN_URL must target the disposable CI PostgreSQL service}"
command -v psql >/dev/null
command -v createdb >/dev/null
command -v dropdb >/dev/null
command -v docker >/dev/null

# Match the PostgreSQL 16 server's major client version. The runner's default
# pg_dump/pg_restore may be newer and emit settings unsupported by PostgreSQL 16.
pg16_dump() {
  docker run --rm --network host -v "$tmpdir:/backup" postgres:16 pg_dump "$@"
}
pg16_restore() {
  docker run --rm --network host -v "$tmpdir:/backup" postgres:16 pg_restore "$@"
}

for name in agent_hq_recovery_baseline agent_hq_recovery_source agent_hq_recovery_restore agent_hq_recovery_rollback; do
  if [[ ! "$name" =~ ^agent_hq_recovery_[a-z]+$ ]]; then
    echo "Refusing unexpected database name: $name" >&2
    exit 1
  fi
done

tmpdir="$(mktemp -d)"
cleanup() {
  dropdb --if-exists --maintenance-db="$ADMIN_URL" agent_hq_recovery_rollback >/dev/null 2>&1 || true
  dropdb --if-exists --maintenance-db="$ADMIN_URL" agent_hq_recovery_restore >/dev/null 2>&1 || true
  dropdb --if-exists --maintenance-db="$ADMIN_URL" agent_hq_recovery_source >/dev/null 2>&1 || true
  dropdb --if-exists --maintenance-db="$ADMIN_URL" agent_hq_recovery_baseline >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
}
trap cleanup EXIT

for name in agent_hq_recovery_baseline agent_hq_recovery_source agent_hq_recovery_restore agent_hq_recovery_rollback; do
  dropdb --if-exists --maintenance-db="$ADMIN_URL" "$name"
  createdb --maintenance-db="$ADMIN_URL" "$name"
done

# Create a pre-migration baseline and take a recovery point before schema changes.
psql "${ADMIN_URL%/*}/agent_hq_recovery_baseline" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE recovery_marker (id integer PRIMARY KEY, marker text NOT NULL);
INSERT INTO recovery_marker VALUES (1, 'pre-migration-baseline-preserved');
SQL
pg16_dump --format=custom --file=/backup/baseline.dump "${ADMIN_URL%/*}/agent_hq_recovery_baseline"
pg16_restore --exit-on-error --dbname="${ADMIN_URL%/*}/agent_hq_recovery_rollback" /backup/baseline.dump
BASELINE_MARKER="$(psql "${ADMIN_URL%/*}/agent_hq_recovery_rollback" -Atqc "SELECT marker FROM recovery_marker WHERE id=1")"
test "$BASELINE_MARKER" = "pre-migration-baseline-preserved"
if psql "${ADMIN_URL%/*}/agent_hq_recovery_rollback" -Atqc "SELECT to_regclass('public.agent_tasks') IS NOT NULL" | grep -qx t; then
  echo "Rollback restore unexpectedly contains Agent HQ migrations" >&2
  exit 1
fi

# Apply the exact production migration chain only to the disposable source database.
SOURCE_URL="${ADMIN_URL%/*}/agent_hq_recovery_source"
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -f tests/agent-hq-provision-test-roles.sql
for migration in \
  drizzle/0003_agent_hq.sql \
  drizzle/0004_agent_budget.sql \
  drizzle/0005_agent_approval_idempotency.sql \
  drizzle/0006_agent_web_search_budget.sql \
  drizzle/0007_agent_task_access.sql \
  drizzle/0008_agent_budget_trusted_settlement.sql \
  drizzle/0009_agent_hq_runtime_rls.sql \
  drizzle/0010_agent_hq_authenticated_worker_identity.sql; do
  psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -f tests/agent-hq-register-test-workers.sql
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -f tests/agent-hq-role-isolation.sql

# Insert a deterministic data marker, create a physical backup, then restore it.
psql "$SOURCE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE recovery_payload (id integer PRIMARY KEY, payload text NOT NULL);
INSERT INTO recovery_payload VALUES (42, 'agent-hq-backup-roundtrip-ok');
SQL
pg16_dump --format=custom --file=/backup/agent-hq.dump "$SOURCE_URL"
RESTORE_URL="${ADMIN_URL%/*}/agent_hq_recovery_restore"
pg16_restore --exit-on-error --dbname="$RESTORE_URL" /backup/agent-hq.dump

RESTORED_PAYLOAD="$(psql "$RESTORE_URL" -Atqc "SELECT payload FROM recovery_payload WHERE id=42")"
test "$RESTORED_PAYLOAD" = "agent-hq-backup-roundtrip-ok"
RESTORED_WORKERS="$(psql "$RESTORE_URL" -Atqc "SELECT count(*) FROM agent_worker_principals WHERE enabled")"
test "$RESTORED_WORKERS" = "19"
RESTORED_RLS="$(psql "$RESTORE_URL" -Atqc "SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('agent_tasks','agent_messages','agent_runs','agent_artifacts','agent_approvals','agent_task_access') AND relrowsecurity AND relforcerowsecurity")"
test "$RESTORED_RLS" = "6"

echo "BACKUP_RESTORE=PASS"
echo "RESTORED_ENABLED_WORKER_PRINCIPALS=$RESTORED_WORKERS"
echo "RESTORED_RLS_FORCED_TABLES=$RESTORED_RLS"
echo "PRE_MIGRATION_ROLLBACK_RESTORE=PASS"
