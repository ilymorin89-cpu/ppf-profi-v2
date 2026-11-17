# Agent HQ database isolation design (pre-implementation)

Status: design only. This document does not create database roles, grant privileges, enable RLS, or change any database.

## Problem

The current worker processes share one PostgreSQL connection identity. Role allowlists in the CLI and role-specific prompts/tools are application controls; they do not stop a process holding the shared connection string from querying another role's rows. Prompt instructions are not an authorization boundary.

## Required security properties

1. PostgreSQL must identify the connecting worker independently of values supplied in SQL parameters or environment variables.
2. A specialist must not read or mutate another specialist's tasks, messages, artifacts, runs, or approvals.
3. Coordinator may create/delegate tasks but must not inherit unrestricted owner privileges.
4. QA may read only the artifacts required for the parent task it is reviewing; it must not approve its own work or execute external actions.
5. Supervisor must have only the lifecycle operations it needs and must not inherit owner/admin privileges.
6. Budget reservation must remain serialized and fail closed. Workers must not be able to change caps or prices.
7. Migrations and role provisioning must use a separate administrative identity; runtime worker logins must not have CREATEROLE, CREATEDB, BYPASSRLS, superuser, or schema-owner rights.

## Candidate implementation

Use distinct PostgreSQL LOGIN identities per worker role and a separately provisioned supervisor identity. Provision them out of band using a database administrator on a disposable staging database first. The application must receive one role-specific connection string per process; never put a shared owner/migration URL in worker environments.

Use PostgreSQL's authenticated connection identity (session_user) as the source of role identity. Do not authorize from current_setting() values that the worker can set, SQL parameters, AGENT_ROLE, task fields, or prompt text. If SET ROLE is used for privilege grouping, policies must still bind to the original authenticated session_user, and role memberships must not permit switching into another worker identity.

Two implementation patterns need a threat-model decision before coding:

### A. Row-level security with immutable identity mapping

- Create a protected mapping from login identity to one Agent HQ role.
- Enable and force RLS on every worker-accessible table, including indirect tables and future tables.
- Policies must use authenticated identity, fail closed for unmapped identities, and avoid recursive policy lookups.
- Use carefully reviewed, fixed-search-path SECURITY DEFINER helpers only where cross-row checks (parent/child task artifacts, QA evidence) are unavoidable. Their owner must be a non-login, narrowly privileged role; revoke PUBLIC execute; validate every argument.
- Revoke direct writes to budget configuration and approval decision columns from workers.
- Add explicit grants and policies for coordinator, QA, and supervisor rather than granting them a broad bypass.

### B. Narrow database procedures

- Revoke direct table access from worker logins.
- Expose a small set of reviewed procedures for claim/heartbeat/complete/fail, message send/inbox, task delegation, artifact retrieval, QA review, budget reservation and supervisor transitions.
- Each procedure derives caller role from session_user, validates task ownership and parent-child relationships, and performs its writes transactionally.
- Keep approval decisions in a separate local operator boundary; a worker procedure may request approval but cannot decide or execute it.
- Procedures must have fixed search_path, explicit argument validation, revoked PUBLIC execute, and a non-login owner with only required table privileges.

Do not combine partial RLS and unrestricted direct table grants: that creates a false sense of isolation. The selected pattern must cover every table and every code path.

## Disposable-database acceptance tests

Run in CI against a fresh PostgreSQL service with at least two specialist logins, coordinator, QA, supervisor, and migration owner:

- SEO login cannot SELECT, INSERT, UPDATE, or DELETE another role's task, messages, runs, artifacts, or approvals.
- SEO cannot impersonate another role by changing AGENT_ROLE, setting custom GUCs, using SET ROLE, or forging task/message fields.
- Coordinator can create child tasks only for allowlisted specialist roles and can see only its own parent plus permitted child status/results.
- QA can retrieve sibling artifacts for the same parent review but cannot read unrelated parents, mutate specialist output, or approve/publish.
- Supervisor can perform only documented lease recovery, QA enqueue and consolidation transitions.
- Worker logins cannot alter budget caps/prices, create roles, disable RLS, change policies, or access schema metadata beyond what is required.
- Unknown login identity is denied by default.
- Migration owner can apply migrations; worker logins cannot.
- All tests include both positive and negative cases and verify SQLSTATE/denial, not only application-layer error messages.

## Rollout boundary

No changes to the existing Agent HQ database are authorized by this design. First implement and test the selected pattern in disposable CI PostgreSQL. Then review grants and migration ownership on a newly provisioned staging database. Only after successful tests and a separate explicit approval may any staging runtime be connected. Production website, production database default_db, Timeweb deployment, network, secrets, worker activation and spend remain out of scope.

## Implementation sequence and operational rule

Before adding a production-style privilege migration, complete the operation inventory and permission matrix in `POSTGRES-ROLE-PERMISSION-MATRIX.md`. The existing worker and supervisor use many direct SQL statements. A policy set is not ready merely because isolated SELECT/UPDATE examples pass.

The CI acceptance harness must invoke the same worker/supervisor operations against role-specific logins. Use a deterministic injected Responses API client in tests so the full lifecycle is exercised without internet access, API keys or charges. Any database helper functions must have a dedicated non-login owner, fixed search_path, revoked PUBLIC execute and explicit argument validation.

Do not enable RLS on an existing shared-login runtime database. Do not make the role-isolation harness itself a deployable migration. Do not provision roles, passwords or runtime URLs outside disposable CI as part of this phase.
