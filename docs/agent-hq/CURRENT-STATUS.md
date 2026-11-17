# Agent HQ — current source-of-truth status

Updated: 2026-11-18
Repository: ilymorin89-cpu/ppf-profi-v2

This file supersedes older snapshot reports and continuation prompts when they conflict with the current repository state. Historical CI results remain valid only for their exact historical commit SHAs.

## Executive status

The Agent HQ implementation has a substantial working foundation. Historical isolated CI runs proved the 19-role deterministic no-egress path, PostgreSQL migration/role isolation, recovery and four-agent lifecycle on earlier commits. The current launch candidate is not yet approved for paid operation.

No current candidate PR has passed CI on its exact latest head because GitHub Actions jobs are failing before the first step is allocated. No live staging database preflight has been completed on the current candidate, and the Timeweb deployment still points to an older branch.

## Current PR stack

| PR | State | Purpose |
|---|---|---|
| #131 | Draft, open | Timeweb PostgreSQL connectivity diagnostics |
| #132 | Draft, open | Ensure diagnostics are included in CI |
| #133 | Draft, open | Four-agent deterministic no-egress orchestration |
| #134 | Draft, open | Staging principal provisioning order and manifest |
| #136 | Draft, open | Bounded model input reservation and provider usage evidence |
| #137 | Draft, open | Live 19-role runtime Compose with separate PostgreSQL LOGIN URLs |
| #135 | Closed, not merged | Superseded old Compose-only 16-worker change; do not reopen or merge |

PR #136 is stacked on the #134 branch. PR #137 is stacked on PR #136. Keep the dependency order; do not merge later PRs independently of their bases.

Links:
- https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/131
- https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/132
- https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/133
- https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/134
- https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/136
- https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/137

## What is implemented in the integrated code

- 19 specialist logical roles.
- Trusted PostgreSQL budget reservation/settlement ledger in migration 0008.
- Role-derived authorization using authenticated PostgreSQL session_user.
- Runtime RLS and FORCE RLS migrations 0009/0010.
- Separate LOGIN identities for 19 workers, Supervisor and Operator.
- Scoped worker task, message, artifact, approval and run access.
- Trusted lease claim, heartbeat, transition, recovery and budget functions.
- Supervisor lifecycle and deterministic four-agent no-egress test.
- Deterministic all-19-container no-egress test.
- Backup/restore proof on a disposable PostgreSQL database.
- Read-only Timeweb PostgreSQL connectivity diagnostic.
- Runtime budget refuses to claim tasks while disabled or caps/prices are zero.

Historical successful CI evidence:
- PR #123 reports CI run #532 passing PostgreSQL integration, website build and all-19-container deterministic no-spend E2E.
- PR #125 reports CI run #543 passing migration-only RLS/ACL, integration, no-spend simulation, Compose/systemd validation, container build and all-19-container E2E.
- PR #126 reports CI run #548 passing the same major gates after authenticated worker principals.
- PR #127 reports a successful disposable backup/restore/rollback proof.
These are historical proofs for their exact tested SHAs, not proof that the current #137 head passes.

Current #137 branch head: 5bc2588294b0481d3363148d3a7ba38bf959346c. Latest workflow run #644 on earlier head 5e2804b9ad259be0985a38590abd274e4a63328b and PR run #643 on 6bc635b4877a6f64a17715bf0a3a04c6eb3cd4f2 again created the expected jobs but every job failed before the first step; step arrays remain empty. The exact latest head has not passed CI.

## Current follow-on changes

### PR #136 — budget envelope

- Replaces the selected-task-text heuristic with a 48 KiB maximum request-input envelope for each of four model turns.
- Measures the complete serialized model instructions, current input and tool schemas before every provider request.
- Rechecks later turns after tool/search output is added.
- Requires valid provider token usage and checks it against per-turn input/output limits.
- Requires provider response IDs in live mode and records all response references for settlement evidence.
- Persists known partial usage and response references in the unknown-reservation reconciliation reason.
- Corrects stale billing-audit claims: the current migration already has separate reservations, settlements and ledger entries; actual settlement is capped by the reservation; global cap aggregation occurs inside the trusted reserve function.

### PR #137 — live runtime Compose

- Defines 19 separate worker services.
- Each worker receives its own AGENT_HQ_DATABASE_URL_<ROLE> and AGENT_HQ_ENABLE_<ROLE>.
- Supervisor receives a separate agent_supervisor connection and enable gate.
- Operator remains a separate human approval LOGIN, not a worker service.
- All global, role and Supervisor gates default to false.
- Web search and GitHub read integration default off.
- The no-egress test Compose files remain separate from the live runtime Compose.
- The CI workflow now validates the runtime Compose file and checks the new budget helper.

## Current CI failure — infrastructure, not a test result

Latest relevant runs:
- PR #136: run #629, SHA 61c56876265af2729ebdaf29780d84f37867841b.
- PR #137: run #632, SHA 4cfced1334648cc24d1ec3ce700108fab8e020ed.

For both runs, all expected jobs were created but completed as failure before executing the first step. The GitHub job-step API returned empty arrays and there were no job logs. Run #632 was retried once; the retry again ended before any step. Therefore:
- no current syntax test result exists;
- no current Docker Compose config validation result exists;
- no current PostgreSQL migration test result exists;
- no current four-agent or all-19 E2E result exists.

Do not label these failures as application-test failures, and do not label static source read-back as CI success. The next CI action is to restore GitHub-hosted runner allocation (check Actions billing/spending limits and repository/organization Actions policy) or provision a properly isolated self-hosted runner on a suitable dedicated Linux host. Do not assume the Timeweb App Platform container is a suitable self-hosted runner.

## Timeweb deployment facts and blockers

Last observed Timeweb selection (17 Nov 2026; re-confirm before any deployment):
- App: ppf-agent-hq
- Compose path: /docker-compose.yml
- Branch: feat/vk-content-army
- Commit: d032f9d0fc272e5a0b31872021efad71f6ad23bf
- That exact branch has only coordinator, community_manager and qa_security workers plus gateway/Supervisor, all using one shared AGENT_HQ_DATABASE_URL.
- It is not the new 19-role per-login runtime Compose.

Historical application logs reported EHOSTUNREACH / CONNECT_TIMEOUT for PostgreSQL. This proves failed reachability at that time, not a successful application DB session. The latest read-only diagnostic must pass from the actual Agent HQ container before migrations or workers are enabled.

The runbook requires a separate database named agent_hq_staging. Do not assume the existing agent_hq database is staging or repurpose the PPF PROFI website database. Provision 19 worker LOGINs plus agent_supervisor and agent_operator with unique secrets and safe NOINHERIT/no-membership flags. Apply migrations 0003–0011 in the documented order, register 19 worker IDs, then pass the read-only staging preflight.

## Remaining gates before paid pilot

1. Restore GitHub Actions runner allocation.
2. Pass CI on the exact final PR #137 head, including Docker Compose config, JavaScript tests, PostgreSQL migrations/RLS, four-agent orchestration, all-19 no-egress E2E and backup/restore proof.
3. Independently review the current migration chain and the production Compose/role manifest.
4. Create/verify isolated staging database and 21 runtime/control LOGINs using the staging runbook; do not expose passwords in Git, logs or chat.
5. Pass read-only Timeweb TLS/database identity preflight from the actual runtime.
6. Owner-approve exact provider/model pricing, caps, and the manual daily provider-billing reconciliation procedure.
7. Run a tightly capped paid pilot with Coordinator, SEO, QA Security and Supervisor only.
8. Reconcile actual provider billing against the internal ledger before enabling additional roles.
9. Expand to research roles, then all 19, only after each stage passes.

## Non-actions and safety defaults

- No PR in this stack has been merged by this work.
- No Timeweb setting, branch, network, firewall, database or secret was changed.
- No production or staging migration was executed.
- No worker or Supervisor process was enabled.
- No real provider request, web search, external message, publication, advertising or spend was made.
- Live runtime Compose defaults to all workers and Supervisor disabled.
- Disposable no-spend tests must use the dedicated test Compose files, not the live runtime Compose.
