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
- [ ] 14. Validate model support for hosted web search using a controlled, non-production test.
- [ ] 15. Reconcile token and hosted-search charges against provider billing; code now caps built-in tool calls at 5 per response × 4 model turns and reserves up to 20 search calls before execution.
- [ ] 16. Complete full role/permission/data-exposure review; baseline prompt-injection defenses are now added for task text, messages, artifacts, web pages and repository files.
- [ ] 17. Review database grants and ensure Agent HQ remains isolated from production data.
- [ ] 18. Review dependency advisories and produce a lockfile-backed patch in an isolated branch. Advisory review confirms React 19.2.8 is affected by critical RSC RCE (patched in 19.2.9); Next.js 16.3.5 predates the November 2026 security release (patched from 16.4.5). Lockfile-backed update remains pending.
- [ ] 19. Run full CI, container build and disposable end-to-end acceptance tests.
- [ ] 20. Prepare a launch checklist and obtain explicit approval before any deployment, spend or worker activation.

## Current known blockers

1. The configured dependency set includes Next.js 16.3.5 and React/React DOM 19.2.8. Next.js 16.3.5 is inside affected ranges; the vendor's security release is 16.4.5, with 16.4.6 subsequently published as the latest stable 16.x release observed on Nov 17, 2026. React 19.2.8 is affected by critical RSC RCE; 19.2.9 is patched. Proposed conservative patch targets: `next@16.4.6`, `eslint-config-next@16.4.6`, `react@19.2.9`, `react-dom@19.2.9`. Do not edit only package.json: update `package-lock.json` using npm and run full CI. This environment has no outbound DNS/network for npm/GitHub, so the lockfile cannot be regenerated safely here. References: [Next.js releases](https://github.com/vercel/next.js/releases), [React GHSA-xqc2-xf4c-x3h3](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3), [React 19.2.9 release](https://github.com/facebook/react/releases/tag/v19.2.9). Do not deploy this branch until the lockfile is updated and the full build/security checks pass.
2. CI run #113 passed. The latest CI run #44068858073 also passed both `syntax` (including supervisor/CLI E2E tests) and `website-build`. The subsequent documentation-only commit does not alter runtime code. A staging runbook omission was found and corrected: migration 0006 is now applied and its web-search price column is included in verification and the budget template.
3. Agent worker budget remains disabled with zero caps. Workers and supervisor must remain disabled.
4. Web-search billing and configured model compatibility have not yet been verified with a controlled runtime test.
5. Approval commands record an owner's decision only; they do not execute the requested external action.

## Safety invariants

- No production deploy or merge from this branch.
- No access to or migration of production database `default_db`.
- No secrets, database passwords, IP addresses, firewall or Timeweb networking changes.
- No worker/supervisor activation and no model spending while budget is disabled.
- No repository write/deploy/publish/customer-contact tools are exposed to agents.
- Any later live test must use a disposable database and an explicit, tightly capped budget.
