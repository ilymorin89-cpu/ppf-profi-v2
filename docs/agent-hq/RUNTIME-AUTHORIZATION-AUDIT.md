
> **Historical pre-migration audit.** This snapshot predates the integrated runtime RLS migrations 0009/0010 and authenticated principal registry. Do not treat its statements that runtime RLS or 19-role identities are absent as current. Use [CURRENT-STATUS.md](./CURRENT-STATUS.md) and [BILLING-RECONCILIATION-AUDIT.md](./BILLING-RECONCILIATION-AUDIT.md) for the current state.

# Agent HQ — runtime authorization audit and implementation gates

Status: read-only code audit against `agent-hq/enable-research-tools` (2026-11-17). This document records verified gaps; it does not change runtime permissions or authorize a database migration.

## Executive finding

The repository contains a useful disposable PostgreSQL authorization harness, but it is not yet a production-ready authorization deployment. The current harness creates and tests only four LOGIN identities (`agent_seo`, `agent_qa_security`, `agent_coordinator`, `agent_supervisor`). The worker runtime advertises a much larger role roster. The production migration `drizzle/0007_agent_task_access.sql` only creates the task-access registry and explicitly defers RLS enforcement.

Do not enable workers against a live database based on the CI harness alone.

## Verified implementation gaps

### 1. Runtime role coverage is incomplete

- `scripts/agent-hq-worker.mjs` allows 19 logical roles.
- `tests/agent-hq-role-isolation.sql` provisions and exercises only `agent_seo`, `agent_qa_security`, `agent_coordinator`, and `agent_supervisor`.
- The test harness policies map authenticated `session_user` values for SEO, QA, coordinator and supervisor. Other specialist logins fall through to deny branches.
- Column grants and RLS policies must be designed and tested for every role that may actually be launched, or the launch roster must be reduced to the four tested identities until then.

Acceptance: enumerate every role in the launcher and worker registry; each enabled runtime role has a unique LOGIN, explicit table/column grants, row policies, and positive and negative tests. Unknown identities fail closed.

### 2. Production migration does not install the tested RLS model

- `drizzle/0007_agent_task_access.sql` creates `agent_task_access` and its index only.
- The RLS policies, grants and helper functions currently live in `tests/agent-hq-role-isolation.sql`, whose header explicitly says disposable CI only.
- The helper functions in that harness are created by the disposable CI database owner. The permission-matrix document correctly requires a dedicated non-login, narrowly privileged function owner in production.

Acceptance: create a separately reviewed production migration with explicit ownership, fixed `search_path`, revoked PUBLIC privileges, column-level grants, FORCE RLS, and least-privilege helper functions. Do not copy the CI harness verbatim.

### 3. Supervisor lifecycle needs dedicated end-to-end coverage

The supervisor directly performs lease recovery, coordinator parent inspection, QA task creation, scoped task grants, QA verdict inspection, artifact consolidation and parent completion/blocking in `scripts/agent-hq-supervisor.mjs`.

The current E2E acceptance described in the permission matrix covers a deterministic happy path, but rollout still needs explicit negative and recovery cases for:
- concurrent supervisor instances processing the same parent;
- duplicate QA task creation and idempotent grant issuance;
- expired leases and exhausted retries;
- missing, malformed or ambiguous QA verdicts;
- QA REVISE, blocked and dead-letter outcomes;
- artifact access limited to the exact parent under review;
- supervisor restart during a partially completed lifecycle.

Acceptance: deterministic PostgreSQL 16 E2E suite executes the actual supervisor and workers with separate role-specific URLs and verifies every state transition and denial.

### 4. Bus CLI and human approval identity must be separated from worker identities

- `scripts/agent-hq-bus.mjs` accepts role names as command arguments for enqueue/send/inbox/claim and contains privileged operational commands.
- The `send` command accepts a caller-supplied `fromRole`; `approve/reject` updates approval decisions directly after checking a local UID allowlist.
- The test authorization harness does not provision or exercise the documented `agent_operator` identity or an isolated approval-decision path.

Acceptance: workers never receive the bus/operator database URL or an approval-decision capability. Move human decisions to a narrowly scoped operator identity or reviewed fixed-search-path function; derive sender identity from authenticated database identity, not CLI arguments. Test replay, duplicate decisions, unauthorized UID, forged actor and direct table UPDATE denial.

### 5. Budget accounting still needs a runtime reconciliation gate

The worker estimates a maximum run reservation and later writes reported usage/cost to `agent_runs`. The code and CI tests must demonstrate that actual settlement cannot silently exceed per-run, daily or monthly hard caps, including provider errors, retries, concurrent workers and hosted web-search charges.

Acceptance: atomic reservations across all workers; bounded maximum calls/tokens; reconciliation against provider-reported usage and current pricing; explicit handling of over-reservation and under-reservation; circuit breaker before the next call; audit trail for every reservation and settlement. Never treat a local estimate as provider billing confirmation.

## Required implementation sequence

1. Freeze the enabled runtime roster to identities that have explicit, tested grants; keep all workers disabled meanwhile.
2. Build the full SQL operation inventory for worker, supervisor and operator CLI, including every SELECT/INSERT/UPDATE/DELETE and sequence/function use.
3. Design the production role/ownership model and migration from the inventory, not by copying the CI harness.
4. Add per-role positive/negative authorization tests for all enabled roles and all mutable columns.
5. Add actual worker + supervisor + operator PostgreSQL E2E tests with mocked provider responses and no network/model spend.
6. Complete budget reservation/settlement tests under concurrency.
7. Obtain independent QA/security review before any staging credentials or live database migration.

## Explicit non-actions

- No production database was changed.
- No Timeweb panel, secrets, network, branch selection or deployment was changed.
- No worker or supervisor was enabled.
- No live model call, web-search spend, publication, outreach or customer contact occurred.
- This audit is not approval to merge, deploy or activate workers.

## Sources inspected

- `drizzle/0007_agent_task_access.sql`
- `tests/agent-hq-role-isolation.sql`
- `docs/agent-hq/POSTGRES-ROLE-PERMISSION-MATRIX.md`
- `scripts/agent-hq-worker.mjs`
- `scripts/agent-hq-supervisor.mjs`
- `scripts/agent-hq-bus.mjs`
- `scripts/agent-hq-launch.mjs`
- `drizzle/0003_agent_hq.sql` through `drizzle/0006_agent_web_search_budget.sql`
