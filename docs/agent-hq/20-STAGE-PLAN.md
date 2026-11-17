
> **Historical snapshot — do not use as the current launch checklist.** This plan contains pre-migration and pre-19-role status statements that are no longer current. Use [CURRENT-STATUS.md](./CURRENT-STATUS.md) for the live PR stack, implemented migrations, current CI state and remaining launch gates. The exact old CI run references below apply only to their historical SHAs.

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

## 2026-11-17 role-isolation implementation update

- The CI-only harness now uses separate PostgreSQL logins for SEO, QA, coordinator and supervisor; whole-table UPDATE grants were replaced by column-level grants, and scoped cross-task checks use fixed-purpose SECURITY DEFINER helpers.
- The real coordinator, SEO, QA and supervisor code paths have been exercised in disposable PostgreSQL using deterministic mocked Responses API responses. No external API call or model spend was made.
- The test harness is intentionally not a deployable migration: its helper ownership is the disposable CI DB owner, not the dedicated non-login least-privilege owner required for a real runtime.
- The specialist roster beyond the four core identities, operator approval login, full DDL/sequence/unknown-login matrix and a production-grade deployable migration remain open.

## Current known blockers

1. Dependency versions and lockfile are updated on the isolated branch to Next.js/eslint-config-next 16.4.6 and React/React DOM 19.3.1. Dedicated dependency/security validation run `44073968014` passed, and the latest acceptance workflows `44074346705` and `44074354457` passed. Four moderate npm advisories remain in deprecated `@esbuild-kit` dependencies; the breaking `npm audit fix --force` path was intentionally not used. Do not deploy until these advisories and remaining security blockers are resolved.
2. Latest head CI runs `44074346705` (push) and `44074354457` (PR) both passed `syntax` and `website-build`. The syntax job completed the Docker image build; the disposable PostgreSQL/RLS tests and fail-closed budget test passed as part of the test suite. The CI PostgreSQL instance is disposable and is not the live Agent HQ or production database.
3. Agent worker budget remains disabled with zero caps. Workers and supervisor must remain disabled.
4. Web-search billing and configured model compatibility have not yet been verified with a controlled runtime test. No real OpenAI request was made; no API key was supplied in chat and no spend was authorized.
5. Approval commands record a decision only; they do not execute the requested external action. Fixed in the current branch: `approve`/`reject` no longer accept caller-supplied actor names; they derive `uid:<number>` from the OS process UID and require that UID in `AGENT_HQ_APPROVER_UIDS`. Role-bearing CLI inputs are now allowlisted. This is only a trusted local-operator gate, not network authentication or a protected owner dashboard.
6. Runtime workers still share the configured database connection identity. The passing CI E2E proves the four core login paths against the CI-only RLS harness, including QA sibling-artifact access and coordinator/supervisor lifecycle. It does not provision live role credentials or create a deployable migration; production-grade helper ownership, remaining specialist identities, operator role and full permission matrix are incomplete. Do not connect live workers to the prototype harness or treat prompts as an access-control boundary.

## Safety invariants

- No production deploy or merge from this branch.
- No access to or migration of production database `default_db`.
- No secrets, database passwords, IP addresses, firewall or Timeweb networking changes.
- No worker/supervisor activation and no model spending while budget is disabled.
- No repository write/deploy/publish/customer-contact tools are exposed to agents.
- Any later live test must use a disposable database and an explicit, tightly capped budget.


- [x] 21. Document the table/column permission matrix and inventory worker/supervisor SQL paths in `POSTGRES-ROLE-PERMISSION-MATRIX.md`.
- [x] 22. Add disposable-CI tests with separate PostgreSQL LOGINs for SEO, QA, coordinator and supervisor; execute real worker and supervisor code paths under those logins.
- [x] 23. Add deterministic mocked Responses API turns and pass the actual coordinator -> SEO specialist -> QA -> supervisor consolidation E2E without provider HTTP calls or spend.
- [ ] 24. Complete negative tests for all roles, unknown logins, DDL/sequence privileges, all column mutations and all bus/worker/supervisor operations. Current CI coverage is a core-role prototype; see the matrix document for exact limits.
- [ ] 25. Select and implement the final production authorization model, including a dedicated non-login function owner and a reviewed deployable migration. The CI harness is not deployable.
- [ ] 26. Review/remove or justify the convenience launcher/configuration after the production runtime architecture is finalized. Keep worker enablement false.
