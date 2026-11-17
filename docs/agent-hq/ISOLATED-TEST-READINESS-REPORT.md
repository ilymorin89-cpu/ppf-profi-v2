# PPF PROFI Agent HQ — Isolated Test Readiness Report

**Snapshot:** 2026-11-17  
**Repository:** `ilymorin89-cpu/ppf-profi-v2`  
**Candidate PR:** #123 — Integrated isolated no-spend readiness candidate  
**Validated head:** `7db08648016e6721747e9cb0ca50ca3038f94a53`  
**CI run:** #532 — all jobs passed

## Executive result

**ISOLATED TEST CANDIDATE: PASS**

The integrated Agent HQ candidate passed PostgreSQL integration, website build, and all-19-container no-spend E2E in GitHub Actions. The tests used a disposable PostgreSQL database, deterministic `test_stub` provider responses, and an internal Docker network with no external connectivity.

This is evidence that the isolated test implementation works. It is **not approval or evidence of production readiness**.

## Verified results

| Area | Result | Evidence |
|---|---|---|
| Migration chain 0003–0008 | PASS | Applied to disposable PostgreSQL with `ON_ERROR_STOP` |
| PostgreSQL integration suite | PASS | 58 tests passed, 0 failed |
| Website build | PASS | CI job completed successfully |
| 19 role containers | PASS | 19 successful runs |
| Persisted artifacts | PASS | 19 artifacts |
| Provider cost | PASS | 0 micro-USD actual cost |
| Open/unknown reservations after E2E | PASS | 0 |
| Docker network isolation | PASS | Compose default network is `internal: true`; no published ports |
| Deterministic provider | PASS | `test_stub`; no live provider call |
| Web search and GitHub integrations | PASS | Disabled in the no-spend test stack |

The E2E assertion output was:

- `roles: 19`
- `successfulRuns: 19`
- `persistedArtifacts: 19`
- `totalActualCostMicrousd: 0`
- `openReservations: 0`

## Workflow and security tests

The PostgreSQL integration suite passed the following key scenarios:

- Separate PostgreSQL logins for Coordinator, SEO, QA and Supervisor.
- Coordinator → SEO → QA → Supervisor workflow.
- QA REVISE → Coordinator revision → fresh QA PASS.
- QA without an explicit PASS blocks parent completion.
- Supervisor recovers expired worker leases without enabling workers.
- Supervisor blocks expired leases when active or unknown provider reservations exist.
- Operator reconciles unknown reservations after lease expiry.
- Concurrent reservations do not overspend daily/monthly/task/run caps.
- Budget owner is a dedicated NOLOGIN, non-superuser, non-BYPASSRLS role and does not own protected tables.
- Budget owner receives scoped `agent_runs` column privileges; ledger and settlements remain append-only.
- Idempotency replay with identical evidence succeeds; reuse of the same key with altered release reason, unknown reason, provider reference, or no-charge confirmation is rejected.

## Code changes in the integrated candidate

1. **Ambiguous provider outcome:** deterministic test fixture can represent an accepted-but-ambiguous request without making a network call. The marker is honored only in test-stub mode.
2. **Simulator/preflight:** one-shot simulator now invokes the fail-closed preflight and keeps long-running workers disabled.
3. **Budget ACL:** table-wide run/reservation UPDATE grants were replaced with column-scoped privileges; only the generated run ID is readable from `agent_runs` by the function owner.
4. **Idempotency:** keys are bound to the evidence payload, not merely treated as duplicate request labels.
5. **Test launcher:** start/stop targets only `docker-compose.agent-hq-test.yml`, uses project `ppf-agent-hq-no-egress-test`, and `start all` invokes the 19-role result assertion.

## Production readiness: BLOCKED

The candidate must remain in Draft. The following work is deliberately not performed and is still required before any production activation:

- Independent production-specific review of RLS policies, table grants, function owners, sequences and role membership.
- Backup, restore and rollback proof for the production database.
- Verification of Timeweb production branch, environment variables and secret rotation through an approved procedure.
- Process-level worker identity beyond a shared per-role PostgreSQL LOGIN if multiple same-role worker processes must be distinguished cryptographically.
- Approval of real provider models, actual pricing, daily/monthly/task/run caps, external tools, web search and permitted actions.
- Monitoring, alerting, incident recovery and operator procedures for unknown charges and failed reservations.
- A separate production deployment and smoke-test approval.

No production migration was applied. No production database, website deployment, Timeweb settings, secrets, paid API calls, web search, external messages, advertising or spend were used in this validation.

## Final status

- Isolated no-spend test candidate: **PASS**
- Integrated CI on head `7db08648016e6721747e9cb0ca50ca3038f94a53`: **PASS**
- Production readiness: **BLOCKED / NOT APPROVED**
- PR #123: **Draft, open, not merged**
