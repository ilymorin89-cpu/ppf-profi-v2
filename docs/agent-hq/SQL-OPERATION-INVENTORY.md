# Agent HQ SQL operation inventory and authorization review

Status: source-level inventory and design gate, not a production permission grant or migration.

Reviewed on 2026-11-17 against:
- `scripts/agent-hq-worker.mjs`
- `scripts/agent-hq-supervisor.mjs`
- `scripts/agent-hq-bus.mjs`
- `drizzle/0003_agent_hq.sql` through `drizzle/0007_agent_task_access.sql`
- `tests/agent-hq-role-isolation.sql`

## Inventory result

A source scan of tagged postgres.js SQL template literals found:
- Worker: 25 SQL templates (9 SELECT, 9 INSERT, 6 UPDATE, 1 CTE/claim).
- Supervisor: 18 SQL templates (6 SELECT, 6 INSERT, 6 UPDATE).
- Bus CLI: 16 SQL templates (6 SELECT, 4 INSERT, 5 UPDATE, 1 CTE/claim).

These counts are a review index, not proof of exhaustive runtime coverage. Conditional branches, interpolated fragments, helper functions, triggers, foreign-key checks, sequence use, and SQL executed outside tagged templates require separate review.

## Table and operation map

| Runtime | Tables / objects touched | Operation families | Required boundary |
|---|---|---|---|
| Worker | `agent_tasks`, `agent_messages`, `agent_runs`, `agent_artifacts`, `agent_approvals`, `agent_budget_config`, `agent_tasks_id_seq` | Claim/lease/heartbeat/complete/fail; read inbox and task context; create messages, approvals, child tasks, artifacts and runs; settle run usage; read budget | One LOGIN per logical role; row scope to assigned role; immutable routing/identity columns; only required mutable columns; budget read-only; sequence privilege only where proven necessary |
| Supervisor | `agent_tasks`, `agent_task_access`, `agent_messages`, `agent_artifacts` | Recover expired leases; enumerate and lock parents; inspect children and QA verdict; create QA task; issue exact task grants; consolidate artifacts; mark parent done/blocked; notify coordinator | Dedicated non-login-owned service identity; no superuser/BYPASSRLS/table ownership; narrowly scoped lifecycle functions preferred over direct broad UPDATE |
| Bus CLI | All task/message/run/artifact/approval/budget tables; task sequence | Enqueue/send/inbox/claim/heartbeat/complete/fail/status/approvals/approve/reject/recover | Split human operator decision path from service/worker paths; no shared owner URL in interactive commands; derive actor and sender from authenticated DB identity |

## High-risk SQL paths requiring explicit policy tests

1. **Task lifecycle:** claim uses `FOR UPDATE SKIP LOCKED`; heartbeat and completion are conditional on `lease_owner`; failure increments/requeues or dead-letters. Test wrong owner, expired lease, stale status, attempts limit, and forbidden column edits.
2. **Cross-role visibility:** worker reads inbox and sibling artifacts. Parent/sibling artifact reads must be limited to exact grants for the reviewed parent; a generic role-wide read is not acceptable.
3. **Coordinator delegation:** child task creation must require a coordinator-owned parent and an allowlisted specialist role. A caller must not set arbitrary `created_by`, `parent_task_id`, or `assigned_role`.
4. **Messages:** worker path uses the process role, but bus `send` accepts a caller-supplied `fromRole`. Treat the bus as privileged until sender identity is derived from a dedicated authenticated LOGIN or fixed-search-path function. Reject spoofed sender, task mismatch, recipient escalation and idempotency replay.
5. **Approvals:** worker may create pending requests but must not decide them. `approve/reject` uses `AGENT_HQ_OPERATOR_DATABASE_URL` and a root-owned UID allowlist in the CLI. Production acceptance must verify OS UID allowlist ownership/mode, DB LOGIN separation, pending-only update, actor derivation, duplicate decision rejection, and direct UPDATE denial for all other roles.
6. **Budget:** worker takes a transaction advisory lock, reads caps/prices, estimates maximum cost and inserts a reservation in `agent_runs`; later it writes provider-reported usage/cost. Current design must still prove atomic settlement/reconciliation under concurrency, retries, provider failures, price changes, and web-search usage. CI mocks prove no live billing.
7. **Sequences and helper functions:** review `currval`, all sequence grants, SECURITY DEFINER helper owners, function EXECUTE grants, fixed `search_path`, PUBLIC revocation and function argument validation. CI helper ownership by database owner is not a production ownership model.
8. **Bus operational commands:** `claim`, `complete`, `fail`, `inbox` and `send` must bind to the authenticated role LOGIN. Global `enqueue`, `status` and `recover` remain disabled until narrow operator/supervisor functions and read paths exist; `approvals` is restricted to the separate `agent_operator` LOGIN.

## Current test coverage and limits

The disposable PostgreSQL CI harness now provisions distinct LOGINs for all 19 worker roles, maps `session_user` to the matching role, applies narrow baseline grants, and tests own-task plus exact QA/coordinator task visibility; own-artifact plus exact QA/coordinator artifact visibility; forbidden task routing/budget column updates; recipient-only inbox reads; and message-sender anti-spoofing. The operator approval path is separately exercised through its own LOGIN. Supervisor CLI acceptance covers repeated passes without duplicate QA tasks, missing explicit QA verdict blocking, expired lease recovery, two concurrent supervisor processes, QA REVISE blocking, and dead-letter blocking.

Runtime startup now independently verifies the actual PostgreSQL `session_user`: each worker requires `agent_<AGENT_ROLE>`, and the supervisor requires `agent_supervisor`. The check is performed after opening the database connection and before any task or lifecycle SQL. Disposable CI includes negative tests that deliberately pair a valid SEO login with the QA worker role and with the supervisor process.

The CI harness was strengthened to transfer all SECURITY DEFINER helpers (role mapping, scoped task access, coordinator-parent validation, artifact ownership and test budget aggregation) to a dedicated NOLOGIN, non-BYPASSRLS function-owner role. That role receives only the SELECT rights and RLS read policies required by those helpers; runtime LOGINs are not members and the function owner does not own protected tables. Catalog assertions verify owner, SECURITY DEFINER, fixed search_path, role flags, memberships and table ownership.

The CI-only `agent_test_budget_totals()` helper is deliberately not executable by any runtime LOGIN or `PUBLIC`. The role-matrix test calls it only through the disposable database-owner connection to prove that per-role RLS hides other workers' run rows while a trusted test-only aggregate can see the global fixture total. This helper is not a production budget API and must never be copied into a production migration. Production workers still require a separate atomic reservation/settlement service path; the current worker's direct `SUM(agent_runs.cost_microusd)` is role-local under the intended RLS policy.

These tests do **not** prove production authorization:
- the CI harness now models a dedicated `agent_hq_fn_owner_ci NOLOGIN NOBYPASSRLS` owner for SECURITY DEFINER helpers and checks its ownership/ACL boundary; production still needs a separately provisioned and reviewed function owner, privileges and policies;
- there is no reviewed production non-login function owner and no production RLS migration;
- the role-matrix test now covers a broader slice of row visibility and immutable columns, but still does not exercise every SQL template or every mutable column;
- bus `send`, `inbox`, and `claim` verify the authenticated PostgreSQL LOGIN against the requested role; heartbeat/complete/fail resolve the task's visible role and enforce the matching LOGIN.
- Global bus `enqueue`, `status`, and `recover` commands fail closed until dedicated least-privilege service paths are implemented; `approvals` now uses the distinct `agent_operator` LOGIN and never the general `DATABASE_URL`.
- the supervisor lifecycle suite still does not cover restart mid-flow, every parent-specific artifact access boundary, or all lease races;
- provider billing reconciliation is not proven by local estimates or mocked tests.

### Bus CLI hardening follow-up

The bus CLI now derives the permitted role from PostgreSQL `session_user` for `send`, `inbox`, and `claim`; `heartbeat`, `complete`, and `fail` first resolve the task through the caller's visible row scope and then require the matching role LOGIN. Global `enqueue`, `status`, `approvals`, and `recover` commands are disabled until dedicated least-privilege operator/supervisor paths are implemented. A focused CLI test rejects global commands and mismatched role arguments. This is a fail-closed reduction of the CLI surface, not a production RLS implementation.

### Confirmed accounting privilege gap — blocking

A focused review of the current worker and CI grants found that the disposable role-isolation harness still grants runtime roles `UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at)` and `INSERT (...,cost_microusd)` on `agent_runs`. The worker itself directly writes provider usage and final cost on success, and writes the failed status directly on error. This means the current CI harness does not prove protection against a compromised worker forging usage/cost; the existing CI success must not be interpreted as closing this risk.

The worker also reads a global `SUM(agent_runs.cost_microusd)` under role-scoped RLS. That aggregate is not globally authoritative for a runtime LOGIN. The test-only aggregate remains CI-only and is not a replacement.

**Required next change:** replace direct worker reservation/settlement SQL with narrowly scoped trusted reserve/settle/release operations, backed by an append-only/idempotent ledger and conservative treatment of ambiguous provider outcomes. Runtime roles must not be able to INSERT or UPDATE authoritative cost/token fields. A detailed design and negative/concurrency test plan is in `docs/agent-hq/BUDGET-RESERVATION-SETTLEMENT-SECURITY-DESIGN.md`.

## Required production design before any migration

1. Decide which runtime roles are actually enabled. Each enabled role must have one dedicated LOGIN; unknown roles fail closed.
2. Create a dedicated non-login function owner with only the table privileges required by reviewed functions. No runtime identity owns tables or policies.
3. Fix `search_path` on every SECURITY DEFINER function, schema-qualify referenced objects, revoke PUBLIC EXECUTE, and grant EXECUTE only to intended roles.
4. Replace broad lifecycle SQL with narrowly scoped functions where column invariants span multiple fields or tables.
5. Grant explicit SELECT/INSERT/UPDATE columns; no broad table UPDATE for workers. Keep budget configuration and approval decision fields outside worker grants.
6. Enable and FORCE RLS on every relevant table; include both positive and negative tests for every enabled role and every operation/column in this inventory.
7. Derive identity from `session_user`, never from prompt text, role GUC, environment role alone, or CLI-supplied sender/actor fields.
8. Use separate worker, supervisor, operator and migration credentials. Never pass the migration owner URL to runtime services.
9. Test concurrent claims, lifecycle transitions, idempotency, rollback, retries, and billing reservation/settlement against disposable PostgreSQL with no provider calls.
10. Obtain independent security review, backup/restore proof, and explicit owner approval before a live migration.

## Non-actions

No production migration, database login provisioning, Timeweb change, secret change, worker activation, model call, spend, publication, external message or deployment was performed. This document does not authorize any of them.
