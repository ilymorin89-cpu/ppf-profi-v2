# Agent HQ budget reservation and provider-cost reconciliation audit

Status: read-only implementation audit and design gate, reviewed 2026-11-17. No production billing configuration or provider account was accessed.

## Current implementation observed

In `scripts/agent-hq-worker.mjs`:

1. Before a model run, the worker opens a transaction and acquires advisory lock `pg_advisory_xact_lock(781234, 1)`.
2. It reads `agent_budget_config`, refuses disabled/zero caps, and refuses hosted web search when its per-call price is zero.
3. It estimates a reservation using task text plus a fixed 40,000-character allowance, four model turns, configured input/output token prices, a 1,200-token output cap per turn, and up to five built-in tool calls per turn (including web search).
4. It compares the estimate with per-run, task, daily and monthly caps.
5. It inserts an `agent_runs` row with status `running` and the estimate in `cost_microusd`. Running rows are therefore counted as reservations in subsequent daily/monthly SUM queries.
6. On success, it calculates cost from aggregate Responses API input/output token usage and web-search-call count, then overwrites `agent_runs.cost_microusd` with that calculated amount.
7. On failure, it marks the run failed and records an error, but leaves the original estimated cost in `cost_microusd`.

The helper `calculateRunCost` rejects negative/non-finite values and rounds token cost up to the next micro-USD. The integration suite tests arithmetic and disabled-budget refusal. This is useful fail-closed behavior, but it is not provider-invoice reconciliation.

## Confirmed gaps

### 1. Settlement is not checked against reservation

The success path overwrites the reservation with actual calculated usage without asserting `actualCost <= reservedCost`. If actual usage exceeds the estimate, the run can push spend beyond a configured cap. The next run may then be refused, but that does not undo the overrun already incurred.

### 2. Settlement does not share the reservation lock

Reservation uses a global advisory transaction lock; settlement currently updates the run row without acquiring that same lock. A new reservation can calculate daily/monthly totals while a settlement is in flight and see the old reservation rather than the final settled amount. This matters most when actual usage exceeds the estimate.

### 3. Input estimate is not a hard upper bound

The fixed allowance is a heuristic. Prompt instructions, inbox messages, sibling artifacts, accumulated model outputs and hosted web-search results contribute to request context. The current code does not enforce a strict maximum input-context size or reserve from a tokenized, bounded request representation.

### 4. Provider errors can still incur partial charges

A failed HTTP request or interrupted multi-turn run can have incurred provider-side usage. The failure path retains the full estimate, which can overstate or understate actual charges. It does not store per-request usage records or reconcile partial responses.

### 5. No provider invoice reconciliation evidence

The database stores aggregate input/output token counts and total cost, but the run record does not retain a provider response/request identifier, pricing version, per-turn usage, individual search-call usage, or an import/reconciliation status against provider billing exports. Configured prices may not be identical to the actual account invoice after discounts, regional rates, taxes or pricing changes.

## Required design before enabling paid calls

1. **Separate reservation from settlement.** Add immutable reservation amount, settled amount, currency, state, timestamps and a pricing-version reference. Never overwrite the reservation evidence.
2. **Serialize both reservation and settlement.** Use the same advisory lock or a dedicated atomic budget ledger transaction for reservation, settlement, release and daily/monthly aggregation.
3. **Bound the request before sending it.** Set explicit limits for task text, instructions, messages, artifacts, accumulated tool output, model turns, output tokens and hosted search calls. Estimate from the exact bounded request representation, not a fixed unexplained allowance.
4. **Reserve per turn where possible.** Before each provider request, reserve the worst-case cost for that bounded request and maximum allowed tool calls. Settle the returned usage before authorizing the next turn.
5. **Fail closed on overrun.** If provider-reported usage exceeds the reservation or hard cap, record the full observed cost, mark a budget-breach event, block further paid calls, and require operator review. Never silently clamp recorded cost to the cap.
6. **Record provider evidence.** Persist response/request IDs, per-turn input/output tokens, web-search calls, model, price schedule/version, reservation, settlement, provider error and reconciliation timestamp. Do not store secrets or unnecessary prompt content.
7. **Handle partial failures.** Preserve usage from every response already received. Reconcile timeouts/unknown outcomes against provider usage before retrying; do not assume a failed process means zero provider charge.
8. **Test concurrency and recovery.** Use two or more independent worker sessions to reserve simultaneously near daily/monthly limits; race settlement against a new reservation; simulate retries, timeouts, partial response, web-search maximum, price change, worker crash and duplicate settlement.
9. **Reconcile against provider billing exports.** Compare internal usage ledger to actual account usage/invoice data at a defined cadence, alert on variance, and stop paid calls if reconciliation is stale or outside tolerance.
10. **Keep budgets disabled by default.** CI may use temporary caps and mocked Responses API responses only. Do not set real caps or enable web search/model calls until pricing is owner-approved and the reconciliation tests plus provider-side reconciliation process are complete.

## Acceptance tests still needed

- Reservation at cap succeeds; one micro-USD over cap fails before provider request.
- Concurrent reservations cannot jointly exceed daily/monthly hard caps.
- Settlement and reservation serialize; a new run sees the settled amount, not stale reservation.
- Actual cost above reservation records the full cost and trips a durable circuit breaker.
- Actual cost below reservation releases the unused amount without losing audit history.
- Partial usage from failed/timeout responses is retained and reconciled.
- Duplicate settlement is idempotent.
- Pricing changes do not retroactively reprice already reserved runs.
- Web-search calls are charged at the configured versioned price and counted against the per-run maximum.
- Provider billing export reconciliation records variance and blocks further calls when stale/out of tolerance.

## Non-actions

No live OpenAI request, provider billing export, production DB, Timeweb setting, secret, budget activation, worker activation, publication, external message or deployment was performed. This document is not approval to enable paid calls.
