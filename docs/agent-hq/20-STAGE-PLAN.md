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
- [ ] 09. Confirm the latest CI run includes the Compose validation step and passes.
- [x] 10. Add unit tests for tool-call exhaustion, approval payload parsing and citation filtering across Responses API turns.
- [x] 11. Add deterministic idempotency for agent messages and deduplication for pending approvals.
- [ ] 12. Test supervisor parent → specialist → QA → consolidated artifact lifecycle.
- [ ] 13. Test approval request creation, listing, approval and rejection end-to-end.
- [ ] 14. Validate model support for hosted web search using a controlled, non-production test.
- [ ] 15. Reconcile token and hosted-search charges against provider billing and enforce conservative reservations.
- [ ] 16. Review all worker roles, tool permissions, prompt-injection boundaries and data exposure.
- [ ] 17. Review database grants and ensure Agent HQ remains isolated from production data.
- [ ] 18. Review dependency advisories and produce a lockfile-backed patch in an isolated branch.
- [ ] 19. Run full CI, container build and disposable end-to-end acceptance tests.
- [ ] 20. Prepare a launch checklist and obtain explicit approval before any deployment, spend or worker activation.

## Current known blockers

1. The configured dependency set includes Next.js 16.3.5 and React/React DOM 19.2.8. Public vendor advisories list fixes beyond these versions. Do not deploy this branch until the lockfile is updated and the full build/security checks pass.
2. The latest CI run is still in progress; verify its final result and whether it executed the newly added Docker Compose validation step.
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
