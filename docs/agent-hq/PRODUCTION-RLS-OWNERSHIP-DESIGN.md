# Agent HQ production PostgreSQL ownership and RLS design

Status: proposed design for independent security review. This is not a migration and does not authorize provisioning roles or changing a live database.

## Goals

- No worker, supervisor or operator uses the schema/migration owner connection.
- Every worker role has a distinct authenticated PostgreSQL LOGIN.
- Row and column access is enforced by PostgreSQL, not prompt text, environment role names or custom GUCs.
- Cross-task access is explicit, parent-scoped and issued only by the supervisor.
- Multi-column lifecycle invariants are enforced by narrowly scoped functions.
- Unknown identities and unsupported operations fail closed.

## Proposed role classes

| Role class | LOGIN | Purpose | Must not have |
|---|---|---|---|
| `agent_hq_migrator` | NOLOGIN preferred; ephemeral migration credential only if deployment tool requires it | Own schema objects and apply reviewed migrations | Runtime service use, worker connection URL |
| `agent_hq_fn_owner` | NOLOGIN | Own fixed-search-path SECURITY DEFINER functions and receive only required table privileges | LOGIN, CREATEROLE, CREATEDB, superuser, BYPASSRLS |
| `agent_hq_supervisor` | LOGIN | Run the supervisor lifecycle service | Table ownership, BYPASSRLS, CREATEROLE, CREATEDB, operator decision permission |
| `agent_hq_operator` | LOGIN | Run the human approval decision CLI | Worker claim/delegate, task lifecycle writes, budget configuration |
| `agent_<logical_role>` | One LOGIN per enabled worker role | Execute only that role's worker operations | Membership in owner/function-owner/operator/supervisor roles |

The migrator should be used only by a deployment/migration job and disconnected afterward. Runtime LOGINs must not inherit privileges from one another. Do not use a single shared worker LOGIN with `AGENT_ROLE` as the authorization boundary.

## RLS helper ownership model

The CI harness currently creates helper functions as the disposable database owner. Production must not copy that ownership model.

Recommended pattern for review:

1. Create `agent_hq_fn_owner NOLOGIN` separately from the schema owner.
2. Grant it only the specific table/sequence privileges required by reviewed functions.
3. Enable and FORCE RLS on the protected tables.
4. Add policies that permit `agent_hq_fn_owner` only while executing reviewed SECURITY DEFINER functions. Do not give this role BYPASSRLS or table ownership.
5. Each SECURITY DEFINER function must:
   - use a fixed `search_path` (prefer `pg_catalog` only);
   - schema-qualify every table, function and sequence reference;
   - avoid dynamic SQL unless strictly necessary and fully identifier/value-parameterized;
   - derive the caller identity from `session_user`, which remains the authenticated original LOGIN inside SECURITY DEFINER;
   - validate every task ID, role, state transition, parent relationship and requested column;
   - return the minimum data needed by the caller.
6. Revoke all function EXECUTE privileges from PUBLIC; grant each function only to the exact runtime LOGINs that need it.
7. Never grant membership in `agent_hq_fn_owner` to a runtime role. NOLOGIN alone is not sufficient if membership/SET ROLE is available.
8. Verify with catalog assertions that function owner, SECURITY DEFINER flag, search_path, EXECUTE ACLs, table ACLs and RLS policies match the reviewed manifest.

A policy that allows the function owner to access rows is safe only if the function owner cannot be assumed directly and its executable functions enforce the caller's `session_user` identity and input invariants. This design requires independent review before implementation.

## Function boundary proposal

Use small functions rather than broad direct UPDATE privileges for transitions that span identity and state fields:

- `agent_claim_task()`: claim the next queued task assigned to `session_user`'s mapped logical role; atomically set lease owner/expiry/attempt count.
- `agent_heartbeat_task(task_id, worker_id)`: extend only a currently owned, active lease.
- `agent_complete_task(task_id, worker_id, artifact...)`: verify lease owner, transition task, insert artifact and update run in one transaction.
- `agent_fail_task(task_id, worker_id, reason)`: verify lease owner, retry/dead-letter transition and message insertion atomically.
- `agent_send_message(task_id, recipient, kind, body, evidence)`: derive sender role from `session_user`; verify task assignment and allowlisted recipient.
- `agent_delegate_task(parent_id, target_role, ...)`: coordinator only; verify parent is assigned to coordinator and target role is allowlisted.
- `agent_request_approval(task_id, action, payload)`: derive requester from `session_user`; create pending-only request with idempotency.
- `agent_decide_approval(approval_id, decision, actor)`: operator only; update pending request exactly once. OS UID allowlisting remains a separate host control and must be audited; DB should still derive operator LOGIN from `session_user`.
- `agent_supervisor_process_parent(parent_id)`: supervisor only; lock parent, inspect exact children, issue idempotent grants, handle QA verdict and state transitions atomically.
- `agent_reserve_budget(...)` and `agent_settle_budget(...)`: serialize with the same ledger lock, preserve reservation and settlement evidence, and trip a durable circuit breaker on overrun.

Function signatures, ownership, policy exemptions and grants must be generated from the final SQL inventory and reviewed individually. Do not grant broad EXECUTE on a generic table-operation function.

## Direct table access that may remain

Only simple read paths should remain direct, with column-limited SELECT and RLS:
- worker reads own task fields, own inbox and own run usage;
- QA reads artifacts only for task IDs granted for the exact parent review;
- coordinator reads parent and explicitly granted child status/evidence;
- supervisor reads lifecycle records it must process;
- operator reads only pending approval fields needed by the CLI.

Any direct INSERT/UPDATE path must be justified per table and per column. The bus CLI must not accept a caller-supplied `fromRole` as proof of identity. Either route it through the authenticated message function or remove/restrict that command.

## Required policy and ACL review matrix

For every table, enumerate all operations and columns, then assert catalog privileges and runtime behavior:

- `agent_tasks`: SELECT scope; claim/lease/status fields; immutable parent, role, creator, budget and attempt policy.
- `agent_messages`: recipient-only SELECT; sender derived from session identity; immutable conversation/identity fields.
- `agent_runs`: insert identity; usage settlement fields; immutable role, worker, provider, model and task identity.
- `agent_artifacts`: own-task insert; exact-parent QA read grants; no cross-parent read.
- `agent_approvals`: pending request insert; requester-only read; operator-only one-way decision.
- `agent_budget_config`: runtime SELECT of only required pricing/cap columns; no worker UPDATE.
- `agent_task_access`: no direct worker access; supervisor-only idempotent grants.
- sequences: exact USAGE/SELECT requirements only; no sequence ownership or alteration.
- helper functions: exact owner, search_path, EXECUTE ACL and argument validation.

## Rollout sequence

1. Freeze the launch roster to the roles covered by the current CI harness; keep workers disabled.
2. Complete source-level SQL inventory and dynamic/helper/trigger/sequence review.
3. Agree the exact function boundaries and table/column ACL manifest.
4. Implement a new production migration in a separate PR; do not copy `tests/agent-hq-role-isolation.sql`.
5. Run catalog assertions and positive/negative tests for every role and operation against a fresh disposable PostgreSQL instance.
6. Run supervisor concurrency/restart/QA-revise/dead-letter and operator approval E2E tests.
7. Complete billing reservation/settlement ledger and provider reconciliation.
8. Obtain independent security review, backup/restore proof, staging credential review and explicit owner approval.
9. Only then plan a separately approved Timeweb migration/deploy. Keep workers disabled until the post-migration runtime smoke test is signed off.

## Explicit non-actions

No production DDL, LOGIN creation, grants, RLS policy, Timeweb configuration, secret, budget cap, provider call, worker activation, publication, external message or deployment was performed.
