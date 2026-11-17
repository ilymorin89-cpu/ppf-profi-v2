# Agent HQ budget reservation and provider-cost reconciliation audit

Status: corrected source audit for the current integrated Agent HQ code, updated 2026-11-18. This supersedes earlier stale observations. No production billing account, live database, or provider invoice was accessed.

## Confirmed implementation in migrations 0008–0010

The current implementation is materially stronger than the earlier audit recorded:

1. agent_budget_reserve() is a SECURITY DEFINER database function owned by the dedicated non-login agent_hq_budget_owner.
2. It derives role and worker identity from authenticated PostgreSQL session_user, verifies the active task lease, takes advisory transaction lock (781234, 1), checks the enabled budget and pricing, and calculates a maximum reservation from the per-turn input/output limits, maximum turns and maximum hosted search calls.
3. It records a separate reservation row, immutable price snapshot, append-only ledger event, and linked run. Active and unknown reservations count at their full reserved amount; settled reservations count at actual settled cost.
4. agent_budget_settle() locks the reservation row, verifies ownership and lease, validates provider token/search usage against the reservation snapshot, and rejects any actual cost above the reserved amount. It atomically inserts settlement and ledger evidence, changes reservation state and updates the linked run.
5. Provider ambiguity is not silently released. The worker calls agent_budget_mark_unknown() and retains the full reservation for operator reconciliation. Operator-only reconciliation functions require provider evidence or explicit no-charge confirmation after the worker lease expires.
6. Runtime worker LOGINs do not receive direct INSERT/UPDATE privileges for authoritative run cost/token fields. The budget function is the trusted write boundary.
7. Global daily/monthly aggregation occurs inside the trusted reserve function over the shared reservation ledger. It is not a worker-side SUM(agent_runs) filtered by role RLS.

## Corrections to the previous audit

The following earlier claims are stale for the current integrated code and must not be repeated as current blockers:

- The reservation is not merely a cost_microusd value in a running row; it has its own reservation, settlement and ledger records.
- Settlement does check actual_cost <= reserved_microusd; an over-reservation settlement is rejected and remains a reconciliation case.
- The trusted reserve function already performs global daily/monthly aggregation under a single advisory reservation lock. Worker RLS does not cause the global budget to undercount.
- The settlement function does not take the same global advisory lock, but this is not an overspend race under the current invariant: settlement can only replace an active reservation with a settled amount less than or equal to the reserved amount. A concurrent reservation therefore sees either the full active reserve or the lower committed settled amount. Both are conservative with respect to the cap. The row lock and transaction make the reservation state and settlement evidence visible atomically.

## Remaining budget risks and controls

### 1. Input envelope must match the reservation

The previous worker estimated input tokens from selected task fields plus a fixed 40,000-character allowance. That did not bound the actual request assembled from role instructions, recent inter-agent messages, sibling artifacts, tool schemas and accumulated web/search/tool output.

The follow-on branch agent-hq/bounded-budget-input-envelope changes this:
- Reserve a conservative maximum of 48 KiB of UTF-8 request input for each of the four possible model turns.
- Before every Responses API request, measure the complete serialized instructions + current input + tool schemas and reject anything above the same 48 KiB ceiling before network dispatch.
- This check runs again after tool/search output is fed into a later turn.
- Validate provider-reported input and output token counts as present, non-negative integers and within the per-turn reserved envelope.
- Require real provider response IDs and retain all response IDs in the settlement reference field (subject to its 200-character limit).
- Keep provider ambiguity in the unknown state rather than releasing a possibly billable reservation.

The byte ceiling is intentionally conservative and may reserve more than typical actual usage. This can reduce throughput, but it makes the maximum input envelope explicit. The code and unit tests have been committed to the follow-on branch; full CI has not yet confirmed this change.

### 2. Provider invoice reconciliation remains operationally manual

The runtime ledger calculates cost from provider-reported usage and the price snapshot configured in agent_budget_config. It does not automatically import and reconcile the actual provider billing export/invoice. Before scaling beyond a controlled pilot:
- compare provider usage/billing exports with the internal ledger at least daily;
- document the approved model and exact input/output/search prices and currency conversion;
- alert on missing usage, unknown reservations, provider-reference gaps and any variance;
- stop further paid work when reconciliation is stale or outside the owner-approved tolerance.

### 3. Partial and ambiguous provider outcomes

A response timeout, worker crash or malformed response can occur after a provider request may have been accepted. The safe current behavior is to retain the reservation as unknown and block retry until an operator reconciles it. This is deliberately conservative and can temporarily reserve more budget than was ultimately spent. It is safer than silently releasing a potentially billable call.

### 4. Production/staging proof is still absent

Passing disposable CI does not prove the actual Timeweb runtime can reach the intended database, has the correct 21 runtime LOGINs, or is using the reviewed commit. The recorded Timeweb diagnostic previously reported EHOSTUNREACH / CONNECT_TIMEOUT. The live Agent HQ container must pass a fresh read-only database identity/TLS check before migrations or workers are enabled.

## Acceptance evidence required before paid pilot

- Exact follow-on branch SHA passes JavaScript syntax and focused budget-envelope tests.
- Full PostgreSQL migration, role-isolation, four-agent orchestration and 19-container no-egress tests pass on the exact same SHA.
- A dedicated staging database passes the migration-only RLS/ACL and 19-worker principal preflight.
- The production-facing Compose candidate maps every worker to its own LOGIN URL and Supervisor/Operator to their separate identities; no shared owner URL reaches a worker.
- All workers remain disabled until the owner explicitly approves the staging-to-paid-pilot transition.
- First paid pilot starts with a small, owner-approved cap; provider billing is reconciled manually before increasing concurrency or budget.

## Non-actions

No production database, Timeweb configuration, secrets, provider account, real API request, worker activation, publication, external message, advertising or spend was changed by this audit or by the follow-on code preparation.
