# Agent HQ budget reservation and settlement security design

Status: implementation gate and threat-model record. This document is not a production migration and grants no runtime permission.

Reviewed against branch `agent-hq/ci-function-owner-boundary-hardening`, commit `edf7516535bab065524d833a4fe9799d960d16ef`, on 2026-11-17.

## 1. Confirmed current exposure

The worker currently performs the following operations directly:

- Reads `agent_budget_config` and aggregates `SUM(agent_runs.cost_microusd)` to decide whether a new model call fits the global daily/monthly caps.
- Inserts a new `agent_runs` row with caller-supplied `cost_microusd` estimate.
- On success, updates `status`, `input_tokens`, `output_tokens`, `cost_microusd` and `finished_at`.
- On failure, updates `status`, `error` and `finished_at`.

The CI role-isolation harness currently grants every worker LOGIN:
`UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at)` on `agent_runs`. It also grants INSERT including `cost_microusd`.

This means the current CI authorization model does not yet prove that workers are unable to forge token usage or costs. The worker's direct global SUM is also incompatible with the intended role-scoped RLS visibility. Passing CI #396 does not close either issue.

## 2. Security objectives

1. Runtime worker LOGINs cannot directly INSERT or UPDATE authoritative cost/token accounting.
2. A worker cannot settle a run belonging to another role, task, or worker identity.
3. Global daily/monthly spend is evaluated from one trusted, transactionally consistent source.
4. Concurrent reservations cannot oversubscribe a daily, monthly, or per-run cap.
5. Repeated reserve/settle calls are idempotent and cannot double-reserve or double-charge.
6. A provider timeout or worker crash leaves a recoverable reservation state; it must not silently release possibly incurred spend.
7. Any uncertainty about budget state fails closed before another paid provider call.
8. No production migration, credentials, or provider operation is performed by CI.

## 3. Required data model

Implement and test these concepts before considering a production migration:

- **Reservation**: unique reservation ID, run ID, task ID, role, worker identity, idempotency key, reserved maximum cost, pricing version/snapshot, period keys, state and timestamps.
- **Settlement**: unique settlement idempotency key, reservation ID, provider usage, web-search usage, actual cost, final state and provider reconciliation metadata.
- **Budget ledger**: append-only reservation, settlement, release and reconciliation events. Aggregate totals must account for outstanding reservations as well as settled spend.
- **Run linkage**: `agent_runs` stores run lifecycle and references reservation/settlement records; runtime roles cannot authoritatively write usage/cost fields.

All money values remain integer micro-USD. Do not use floating-point arithmetic.

## 4. Trusted authorization boundary

Preferred database design:

- Provision a dedicated `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS` function-owner role out of band.
- It must not own protected tables.
- Grant it only the exact SELECT/INSERT/UPDATE columns required by reviewed budget functions.
- Add explicit RLS policies scoped to that owner for the required ledger operations.
- Functions must be `SECURITY DEFINER`, use a fixed `search_path = pg_catalog, public` (or narrower), schema-qualify objects, validate every argument, and revoke EXECUTE from PUBLIC.
- Runtime workers may receive EXECUTE on narrowly scoped functions only. No runtime LOGIN is a member of the function-owner role.
- Functions derive caller identity from PostgreSQL `session_user`; never trust caller-supplied role, worker, actor, or task ownership values.
- The reserve function must verify the task is currently leased to the authenticated role/worker before creating a reservation.
- The settle function must lock and validate the exact open reservation, verify it belongs to the same authenticated role/run, and atomically write ledger and run accounting.
- Duplicate idempotency keys with identical immutable parameters return the prior result; reuse with different parameters is rejected.

Do not implement a broad global aggregate function that merely exposes all run costs. The trusted API must perform the business operation (reserve/settle/release) and return only the minimum result needed by the caller.

## 5. Reservation algorithm

Within one database transaction:

1. Derive the role from `session_user`.
2. Lock the budget control row (or a dedicated singleton lock row) with `FOR UPDATE`.
3. Validate enabled state, configured prices, per-run cap and task-specific cap.
4. Calculate the maximum possible cost for the configured model turns, output tokens and enabled tools using the price snapshot.
5. Compute settled spend plus all active reservations for the local day and month.
6. Reject if either cap would be exceeded.
7. Insert the reservation and append its ledger event.
8. Create/link the run record.
9. Commit before the provider call.

All reservations use a single consistent timezone/period definition. The configured timezone must be explicit; do not assume server timezone.

## 6. Settlement and failure handling

- Successful provider response: calculate cost from provider-reported usage and the reservation's immutable price snapshot; atomically settle and release unused reserved headroom.
- Provider call failed before any request could be sent: release only when the adapter can prove no billable request was accepted.
- Timeout/connection loss/ambiguous provider response: keep reservation in an `unknown` or reconciliation-required state and continue counting the full reservation against caps.
- Worker crash: reservation remains active until a trusted recovery/reconciliation process resolves it.
- Partial tool/provider failures: record known usage and preserve a conservative upper bound for unknown billable work.
- Settlement retry: idempotent by provider request/response identity and reservation key.
- Never accept cost or token values from a worker as authoritative without validating the provider response and price snapshot in the trusted boundary.

## 7. Required negative and concurrency tests

Run only against disposable PostgreSQL:

- Runtime role cannot INSERT a run with arbitrary cost.
- Runtime role cannot UPDATE cost, input tokens, output tokens, settlement state or reservation fields.
- Runtime role cannot read another role's reservation or ledger rows.
- Runtime role cannot settle another role's run or task.
- Caller-supplied role/worker identity spoofing is rejected.
- PUBLIC cannot execute any trusted budget function.
- Runtime LOGINs have no membership in the function-owner role.
- Duplicate reserve with same key creates one reservation.
- Duplicate reserve with changed parameters is rejected.
- Duplicate settlement with same key changes the ledger once.
- Duplicate settlement with changed usage/cost is rejected.
- Two concurrent reservations near the cap cannot oversubscribe the cap.
- Day/month boundary behavior is deterministic.
- Failed provider call, ambiguous timeout and process crash preserve conservative budget accounting.
- Settlement rollback leaves both run and ledger unchanged.
- Missing/disabled budget config, unavailable ledger, or lock timeout fails closed.

## 8. Implementation sequence

1. Add disposable-PostgreSQL schema and tests for reservation/ledger invariants.
2. Add trusted function-owner setup in the CI harness and catalog/ACL assertions.
3. Implement narrowly scoped reserve/settle/release functions and test their security boundary.
4. Change worker to call only those functions; remove direct accounting SQL.
5. Remove runtime INSERT/UPDATE privileges on authoritative accounting columns.
6. Add recovery/reconciliation tests for ambiguous provider outcomes and worker restarts.
7. Update SQL operation inventory and run full CI on the exact final SHA.
8. Only after independent review, prepare a separately reviewed production migration and manual role-provisioning runbook. Do not apply it automatically.

## 9. Current non-actions

No production migration, database login provisioning, Timeweb change, secret change, worker activation, paid API call, external message, publication, deployment or spend was performed.
