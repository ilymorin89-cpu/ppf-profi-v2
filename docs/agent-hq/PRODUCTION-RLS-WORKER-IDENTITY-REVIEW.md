# Agent HQ Production RLS and Worker Identity Review

**Status: BLOCKED — review finding, not a production approval**

Review base: `agent-hq/integrated-no-spend-readiness`  
Reviewed commit: `41b39d6fd9f740133b54a81c1cbff707f4aaade1`  
Scope: migration chain `0003`–`0008`, CI bootstrap, role-isolation SQL, worker startup and task-claim path.

## Executive result

The isolated CI result remains valid for the CI harness that was executed. It does **not** prove that a database initialized only from the production migration chain has the same row-level security policy set as CI.

Two concrete production blockers were confirmed:

1. Migration `0007_agent_task_access.sql` explicitly creates only the access registry and defers runtime RLS enforcement. The actual RLS policies and helper functions are in `tests/agent-hq-role-isolation.sql`, which is a CI test fixture, not a production migration.
2. Worker identity is role-scoped, not process-scoped. `agent-hq-worker.mjs` reads `AGENT_WORKER_ID` from the environment, while `agent_task_claim(p_worker_id)` trusts the supplied worker ID after mapping `session_user` to a role. Multiple processes using the same role LOGIN can therefore present the same or another worker ID. The database authenticates the role LOGIN, not the individual process.

Do not deploy migrations, start live workers, or call this production-ready until both findings are resolved and independently tested.

## Finding 1 — production migration chain does not install the CI runtime RLS policies

**Evidence**

- `drizzle/0007_agent_task_access.sql` states: “This migration creates the access registry only. Runtime RLS enforcement is intentionally deferred until each worker has a distinct PostgreSQL login.”
- The policies and helper functions for `agent_tasks`, `agent_messages`, `agent_runs`, `agent_artifacts`, `agent_approvals` and `agent_task_access` are instead defined in `tests/agent-hq-role-isolation.sql`.
- `scripts/agent-hq-test-bootstrap.sh` explicitly applies `tests/agent-hq-role-isolation.sql` between migrations 0007 and 0008. Therefore the passing CI database has security objects that a database created from migrations 0003–0008 alone does not receive.
- Migration `0008_agent_budget_trusted_settlement.sql` enables RLS on tasks, runs, budget config and budget accounting tables, and adds policies for `agent_hq_budget_owner`; it does not install the full runtime task/message/artifact/approval/access policy set from the CI fixture.

**Impact**

A production migration-only database can have a materially different authorization model from CI. In particular, task visibility and cross-role access rules tested in CI are not guaranteed to exist after applying only the migration chain. RLS-enabled tables without applicable runtime policies can deny legitimate worker access; tables without RLS may not enforce the tested row boundaries.

**Required correction**

- Move reviewed runtime helper functions, policies, grants and RLS enable/force statements into versioned production migrations.
- Keep test-only seed data and disposable credentials out of production migrations.
- Add a migration-only integration test that initializes an empty disposable PostgreSQL database using exactly the production migration sequence, without applying `tests/agent-hq-role-isolation.sql`.
- Assert `relrowsecurity`, `relforcerowsecurity`, policy definitions, function owners, EXECUTE grants and table/column privileges for every Agent HQ table.
- Run the existing isolation tests against that migration-only database, not a test fixture that creates the security boundary itself.

## Finding 2 — worker ID is supplied by the process and is not authenticated by PostgreSQL

**Evidence**

- `scripts/agent-hq-worker.mjs` sets `workerId` from `AGENT_WORKER_ID` (or a process-derived fallback).
- Startup verifies only that `session_user` equals `agent_<role>`.
- `agent_task_claim(p_worker_id)` maps `session_user` to a role and writes the caller-provided `p_worker_id` into `lease_owner`; it does not independently verify that the worker ID is bound to that authenticated database principal.
- The reserve, heartbeat, settle, release, unknown-outcome and task-transition functions use the supplied worker ID to match the lease/reservation.

**Impact**

A process with the shared role LOGIN can claim or operate a lease using another process's worker ID if it knows or guesses that identifier. The current boundary proves role identity, not unique worker-process identity. This is especially relevant if multiple replicas of the same role are ever started.

**Required correction**

- Introduce a database-owned worker-principal registry mapping each authenticated PostgreSQL LOGIN to exactly one role and immutable worker instance ID.
- Provision a distinct LOGIN per concurrently running worker instance; do not grant membership that permits one worker to SET ROLE as another.
- Have trusted SQL functions derive both role and worker ID from `session_user` and reject caller parameters that do not match the registry.
- Change worker startup to validate the authenticated identity against the database mapping rather than requiring a single fixed `agent_<role>` LOGIN.
- Add negative tests proving a worker cannot claim, heartbeat, settle, release, transition or reconcile using another worker's ID.
- Ensure operator and supervisor identities remain separate and explicitly provisioned.

## Verification plan

1. Create a disposable PostgreSQL database from migrations 0003–0008 only.
2. Assert all production RLS and ACL objects exist before any test fixtures run.
3. Run positive and negative row-isolation tests against that database.
4. Run two concurrent workers for the same logical role with distinct PostgreSQL logins and worker IDs.
5. Attempt cross-worker lease/settlement operations and require SQLSTATE 42501.
6. Run the complete 19-role no-egress E2E suite against the same migration-only security setup.
7. Confirm zero provider calls, zero actual cost, zero open reservations, and no external network access.

## Current decision

- Isolated CI candidate: previously passed.
- Production RLS equivalence: **NOT PROVEN**.
- Per-process worker identity: **NOT IMPLEMENTED / NOT PROVEN**.
- First practical test using the existing test harness: technically possible but does not close these production blockers.
- First practical test intended to validate production-equivalent security: **BLOCKED**.

No production database, migration, deployment, secret, paid provider, external message, advertisement or persistent worker was touched during this review.
