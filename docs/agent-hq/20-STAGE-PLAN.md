# Agent HQ — 20-stage safe implementation plan

Scope: isolated Agent HQ branch only. Production website, production database `default_db`, Timeweb deployment settings, credentials, network rules, external publishing, advertising spend and worker activation are out of scope without separate explicit approval.

## Progress

- [x] 01. Confirm isolated branch and keep the Timeweb deployment branch unchanged.
- [x] 02. Confirm dedicated Agent HQ database connectivity and fail-closed budget defaults.
- [x] 03. Review worker task claiming, leases, heartbeat and retry behavior.
- [x] 04. Add bounded tool-loop handling; refuse tool actions when the final response turn is exhausted.
- [x] 05. Make approval payload parsing tolerant of plain text and valid JSON.
- [x] 06. Add owner-facing approve/reject commands with one-way pending-state transitions.
- [x] 07. Add an integration test for auditable, one-time approval decisions.
- [x] 08. Add Docker Compose configuration validation to the CI workflow definition.
- [x] 09. Confirm CI run #113 passed both jobs, including PostgreSQL migrations 0003–0006, integration tests, systemd validation, Docker Compose validation and website build.
- [x] 10. Add unit tests for tool-call exhaustion, approval payload parsing and citation filtering across Responses API turns.
- [x] 11. Add deterministic idempotency for agent messages and deduplication for pending approvals.
- [x] 12. Test supervisor parent → specialist → QA → consolidated artifact lifecycle (real CLI E2E test; CI run 44068858073 passed).
- [x] 13. Test approval request creation, listing, approval and rejection end-to-end (real CLI E2E test; CI run 44068858073 passed).
- [x] 13a. Re-run both PR and push workflows at head `a7a737da3a1a9915f488af0faa0e261ecdaf8cd6`; runs `44070528396` and `44070516702` both passed `syntax` and `website-build` on 2026-11-17.
- [ ] 14. Validate model support for hosted web search using a controlled, non-production test.
- [ ] 15. Reconcile token and hosted-search charges against provider billing; code now caps built-in tool calls at 5 per response × 4 model turns and reserves up to 20 search calls before execution.
- [ ] 16. Complete full role/permission/data-exposure review; CLI role allowlists and OS-UID approval gating are implemented and covered by tests, but DB-enforced per-role isolation remains open.
- [ ] 17. Review database grants and ensure Agent HQ remains isolated from production data.
- [x] 18a. Generate lockfile-backed dependency update on isolated branch `agent-hq/enable-research-tools`: Next.js/eslint-config-next 16.4.6, React/React DOM 19.3.1. CI `44071860542` completed successfully for `npm ci` and lockfile generation. Full dependency audit, integration tests and website build are being run in dedicated validation workflow `44072584940` before treating the update as accepted.
- [ ] 19. Run full CI, container build and disposable end-to-end acceptance tests.
- [ ] 20. Prepare a launch checklist and obtain explicit approval before any deployment, spend or worker activation.

## Current known blockers

1. Dependency versions and lockfile have been updated on the isolated branch to Next.js/eslint-config-next 16.4.6 and React/React DOM 19.3.1. The lockfile generation and `npm ci` passed in run 44071860542. Full audit, integration tests and build are under validation in run 44072584940. Do not deploy until those checks pass and remaining security blockers are resolved.
2. CI run #113 passed. The latest CI run #44068858073 also passed both `syntax` (including supervisor/CLI E2E tests) and `website-build`. The subsequent documentation-only commit does not alter runtime code. A staging runbook omission was found and corrected: migration 0006 is now applied and its web-search price column is included in verification and the budget template.
3. Agent worker budget remains disabled with zero caps. Workers and supervisor must remain disabled.
4. Web-search billing and configured model compatibility have not yet been verified with a controlled runtime test.
5. Approval commands record a decision only; they do not execute the requested external action. Fixed in the current branch: `approve`/`reject` no longer accept caller-supplied actor names; they derive `uid:<number>` from the OS process UID and require that UID in `AGENT_HQ_APPROVER_UIDS`. Role-bearing CLI inputs are now allowlisted. This is only a trusted local-operator gate, not network authentication or a protected owner dashboard.
6. The current worker model does not provide database-enforced per-role isolation: workers share the configured DB connection identity, while role restrictions are enforced in application code and prompt/tool definitions. Before live multi-role operation, use separate least-privilege DB roles or narrowly scoped server-side operations, and prove that one role cannot read or mutate another role's tasks, messages, approvals or artifacts. Do not treat prompt instructions as an access-control boundary.

## Safety invariants

- No production deploy or merge from this branch.
- No access to or migration of production database `default_db`.
- No secrets, database passwords, IP addresses, firewall or Timeweb networking changes.
- No worker/supervisor activation and no model spending while budget is disabled.
- No repository write/deploy/publish/customer-contact tools are exposed to agents.
- Any later live test must use a disposable database and an explicit, tightly capped budget.
