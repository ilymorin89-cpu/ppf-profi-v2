# PPF PROFI Agent HQ

**Current status:** runtime implementation and 19-role authorization foundation are present in the repository. No live worker processes are running and paid operation is not approved.

Use [CURRENT-STATUS.md](./CURRENT-STATUS.md) as the source of truth for current branches, PR dependencies, CI status, Timeweb blockers and launch gates.

## Implemented foundation

- 19 specialist worker roles with durable PostgreSQL tasks, messages, runs, artifacts and approvals.
- Trusted budget reservations, settlements, ledger events and operator reconciliation functions.
- Runtime RLS and authenticated PostgreSQL principal identity.
- Separate LOGIN identities for each worker role, Supervisor and Operator.
- Coordinator delegation, Supervisor lifecycle, QA review and lease recovery.
- Deterministic disposable PostgreSQL tests, no-egress four-agent orchestration and all-19-container test stack.
- Read-only Timeweb PostgreSQL connectivity diagnostic.
- Draft live runtime Compose with one database URL per worker role and disabled-by-default gates.

## Runtime safety

- All worker and Supervisor gates default to false.
- No worker may use a shared database owner or website database credential.
- Web search and GitHub read integration default off.
- Provider ambiguity retains a budget reservation for operator reconciliation.
- Production deployment, external publishing, advertising and outreach remain approval-gated.

## Test and deployment separation

Use docker-compose.agent-hq-test.yml and docker-compose.agent-hq-four-agent-test.yml only for deterministic no-egress tests with the test_stub provider and disposable PostgreSQL.

The root docker-compose.yml in the current candidate branch is the live runtime Compose. It must not be used for no-spend simulation. It is still a Draft PR candidate and must pass exact-head CI and a dedicated staging preflight before Timeweb selects it.

## Historical documents

Documents titled as audits, design snapshots or readiness reports may contain historical status statements. Read their superseded banners and compare them with CURRENT-STATUS.md before relying on them.
