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
- [ ] 16. Complete full role/permission/data-exposure review. The expanded disposable-CI RLS harness now passes on head `16f4970cef186eea6f56e020629f460b16f83f3f` in runs `44074346705` (push) and `44074354457` (PR). It exercises task/artifact isolation, messages, runs, approvals, anti-GUC spoofing, denied SET ROLE, budget immutability and approval-decision denial. This remains a CI-only prototype, not a deployable migration; QA sibling-artifact access and complete coordinator/supervisor workflows still require design and tests.
- [ ] 17. Review database grants and ensure Agent HQ remains isolated from production data.
- [x] 18a. Generate lockfile-backed dependency update on isolated branch `agent-hq/enable-research-tools`: Next.js/eslint-config-next 16.4.6, React/React DOM 19.3.1. CI `44071860542` completed successfully for `npm ci` and lockfile generation. Full dependency audit, integration tests and website build are being run in dedicated validation workflow `44072584940` before treating the update as accepted.
- [x] 19a. Run final CI on latest head `16f4970cef186eea6f56e020629f460b16f83f3f`: push run `44074346705` and PR run `44074354457` both passed `syntax` and `website-build`. The syntax job built Docker image `ppf-agent-hq:ci`; logs confirm `npm ci --omit=dev` and image export completed. Expanded RLS and disabled-budget acceptance tests are included in the passing syntax job.
- [ ] 20. Prepare a launch checklist and obtain explicit approval before any deployment, spend or worker activation.

## Current known blockers

1. Dependency versions and lockfile are updated on the isolated branch to Next.js/eslint-config-next 16.4.6 and React/React DOM 19.3.1. Dedicated dependency/security validation run `44073968014` passed, and the latest acceptance workflows `44074346705` and `44074354457` passed. Four moderate npm advisories remain in deprecated `@esbuild-kit` dependencies; the breaking `npm audit fix --force` path was intentionally not used. Do not deploy until these advisories and remaining security blockers are resolved.
2. Latest head CI runs `44074346705` (push) and `44074354457` (PR) both passed `syntax` and `website-build`. The syntax job completed the Docker image build; the disposable PostgreSQL/RLS tests and fail-closed budget test passed as part of the test suite. The CI PostgreSQL instance is disposable and is not the live Agent HQ or production database.
3. Agent worker budget remains disabled with zero caps. Workers and supervisor must remain disabled.
4. Web-search billing and configured model compatibility have not yet been verified with a controlled runtime test. No real OpenAI request was made; no API key was supplied in chat and no spend was authorized.
5. Approval commands record a decision only; they do not execute the requested external action. Fixed in the current branch: `approve`/`reject` no longer accept caller-supplied actor names; they derive `uid:<number>` from the OS process UID and require that UID in `AGENT_HQ_APPROVER_UIDS`. Role-bearing CLI inputs are now allowlisted. This is only a trusted local-operator gate, not network authentication or a protected owner dashboard.
6. Runtime workers still share the configured database connection identity. The passing RLS harness proves a proposed separate-login pattern only in disposable CI; role-specific production/staging credentials, a reviewed deployable migration, QA sibling-artifact access and complete coordinator/supervisor policies are not implemented. Do not connect live workers to the prototype harness or treat prompts as an access-control boundary.

## Safety invariants

- No production deploy or merge from this branch.
- No access to or migration of production database `default_db`.
- No secrets, database passwords, IP addresses, firewall or Timeweb networking changes.
- No worker/supervisor activation and no model spending while budget is disabled.
- No repository write/deploy/publish/customer-contact tools are exposed to agents.
- Any later live test must use a disposable database and an explicit, tightly capped budget.
