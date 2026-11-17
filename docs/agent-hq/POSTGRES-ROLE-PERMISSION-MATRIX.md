# Agent HQ PostgreSQL authorization matrix

Status: implementation specification for disposable CI only. This document does not authorize or perform any live database change.

## Design decision

Use direct PostgreSQL table access protected by row-level security, with a separate LOGIN per runtime identity and a non-login migration/owner identity. Do not use shared runtime credentials, role-bearing GUCs, or application prompt text as an authorization mechanism.

The first implementation target is a fresh PostgreSQL 16 CI database. Runtime role connections are accepted only when session_user matches the mapped login. Unknown logins fail closed. PUBLIC receives no table privileges. The migration owner is never used by workers.

A procedure-only design remains an alternative if safe row policies cannot express the required cross-task relationships without broad grants. Do not mix partial RLS with broad direct table privileges.

## Runtime identities

| Identity | Purpose | Access |
|---|---|---|
| migration owner | apply schema changes in disposable CI | DDL; not used at runtime |
| agent_seo | SEO worker | own tasks, messages, runs, artifacts and approvals; read budget |
| agent_web_engineer | engineering worker | role-scoped access; no repository writes |
| agent_analytics | analytics worker | role-scoped access |
| agent_community_manager | community worker | role-scoped access; no VK write tools |
| agent_coordinator | coordinator worker | own parent, create allowlisted children, access granted children |
| agent_qa_security | independent QA | own QA task and sibling evidence for exact parent review |
| agent_supervisor | lifecycle service | documented lifecycle operations and scoped grants |
| agent_operator | human approval CLI | guarded approval decisions only |


### Full worker LOGIN roster now covered by the disposable CI identity map

| Logical worker role | PostgreSQL LOGIN |
|---|---|
| coordinator | agent_coordinator |
| web_engineer | agent_web_engineer |
| seo | agent_seo |
| geo | agent_geo |
| growth | agent_growth |
| analytics | agent_analytics |
| qa_security | agent_qa_security |
| vk_strategist | agent_vk_strategist |
| copywriter | agent_copywriter |
| designer | agent_designer |
| image_generator | agent_image_generator |
| storyteller | agent_storyteller |
| community_manager | agent_community_manager |
| content_seo | agent_content_seo |
| ads_manager | agent_ads_manager |
| trend_scout | agent_trend_scout |
| auto_news_editor | agent_auto_news_editor |
| auto_law_monitor | agent_auto_law_monitor |
| fact_checker | agent_fact_checker |

The role matrix currently proves each LOGIN maps from authenticated `session_user` to its logical role; sees only its own task plus exact QA/coordinator task grants; sees only its own artifacts plus the exact QA/coordinator artifact grants; cannot change task routing identity or budget ownership; reads only messages addressed to itself; and cannot insert a message under another role's sender identity. The operator approval CLI is separately exercised through its own LOGIN. This is a deliberately bounded acceptance slice, not yet a full per-operation/per-column grant audit.

## Data permission matrix

| Table | Specialist | Coordinator | QA | Supervisor | Operator |
|---|---|---|---|---|---|
| agent_tasks | own task/lease fields | own parent + granted children; create children under own parent | own QA task + granted siblings; no specialist mutation | lifecycle transitions | no direct access |
| agent_messages | addressed messages; insert as self | same, task-scoped | same | lifecycle/status messages | no direct access |
| agent_runs | own runs only | own runs only | own QA runs only | lifecycle visibility | no direct access |
| agent_artifacts | own task artifacts | granted children; consolidation via supervisor | sibling artifacts for exact review only | read and consolidate | no direct access |
| agent_approvals | request/read own; cannot decide | same | same | read pending state; cannot decide | guarded decision path only |
| agent_budget_config | read caps/prices only | read only | read only | read only | separate admin configuration |
| agent_task_access | no direct access | no direct access | no direct access | issue scoped grants | no direct access |

## Column restrictions

RLS restricts rows, not columns. Use explicit column-level GRANT for UPDATE and INSERT. Workers may not update task identity, assigned role, creator, parent relationship, attempt limits, budget ownership, approval decision fields, budget caps/prices, access principals/reasons, or run identity/provider/model fields after creation.

Lease, heartbeat, completion and failure state transitions should use narrowly granted columns or reviewed fixed-search-path SECURITY DEFINER functions. Prefer functions for atomic multi-column invariants. Function ownership must be non-login and narrowly privileged; revoke PUBLIC EXECUTE and validate every argument.

## Worker SQL operation inventory

Every SQL path in scripts/agent-hq-worker.mjs must be covered:

1. Claim queued task with FOR UPDATE SKIP LOCKED.
2. Reserve budget transactionally and create run.
3. Block task on rejected budget reservation and notify coordinator.
4. Renew only the lease owned by this worker.
5. Read own inbox and task-scoped context.
6. Read sibling artifacts only for QA with an explicit parent grant.
7. Send messages with sender derived from authenticated DB identity.
8. Create pending approval request and read back only own request.
9. Create coordinator children only under own parent and from allowlisted roles.
10. Read configured pricing for usage reconciliation.
11. Complete owned task and insert artifact atomically.
12. Update only own run usage/status.
13. Record failure only for own task/run and notify coordinator.
14. Perform read-only startup budget check.

No worker may forge created_by, from_role, requested_by, role, lease owner, or approval actor. Derive identity from authenticated DB session or validate in a fixed-search-path function.

## Supervisor SQL operation inventory

Every SQL path in scripts/agent-hq-supervisor.mjs must be covered:

1. Recover expired leases and dead-letter exhausted tasks.
2. Enumerate coordinator parents in review.
3. Lock parent to serialize lifecycle.
4. Inspect children and terminal states.
5. Issue QA/coordinator grants atomically with lifecycle transition.
6. Mark parent blocked/done only under valid lifecycle conditions.
7. Create exactly one QA task.
8. Read QA verdict; reject missing or ambiguous verdict.
9. Collect permitted artifacts and write consolidated result.
10. Notify coordinator of blocked/completed results.

Supervisor must not be superuser, table owner, BYPASSRLS, CREATEROLE or CREATEDB. Prefer narrowly scoped functions for lifecycle transitions.

## Required negative tests

- SELECT/INSERT/UPDATE/DELETE on foreign role rows.
- UPDATE forbidden columns on own rows.
- Forge created_by, from_role, requested_by, lease owner and approval decision.
- Change custom GUCs and AGENT_ROLE; access must remain unchanged.
- SET ROLE to another login must fail.
- Read unrelated tasks, parents, sibling artifacts and messages.
- Attempt DDL, role creation, RLS disable, trigger/policy changes and sequence misuse.
- Unknown login identity must be denied.
- Budget config and approval decision fields remain protected.
- Coordinator, QA and specialists cannot create access grants.

## Required positive tests

- Worker claims and heartbeats only tasks assigned to its role.
- Worker messages another role with sender identity derived from login.
- Worker saves artifact and finishes only its owned task.
- Coordinator creates only allowlisted child roles under its own parent.
- Supervisor grants exact task IDs to coordinator/QA.
- Coordinator sees granted child status/artifacts, not unrelated parents.
- QA sees sibling evidence only within the parent under review.
- Supervisor performs documented lifecycle transitions.
- Operator approves/rejects a pending approval exactly once, but cannot execute the external action.

## Integration acceptance

A disposable PostgreSQL 16 E2E test must run actual worker and supervisor paths using role-specific URLs and deterministic mocked Responses API. No network call or model spend. Assert coordinator -> specialists -> QA -> supervisor consolidation, failure/blocked paths, duplicate supervisor runs, expired leases, concurrent claims, and every denial above.

The SQL harness alone is insufficient. The current disposable CI matrix provisions all 19 worker LOGINs and verifies per-role task visibility plus message-sender anti-spoofing. The integration suite also exercises the operator approval path through a separate LOGIN. Create each test database empty and discard it after the run.

## Rollout gates

- No live database migration or login provisioning in this code task.
- No production database default_db, website, Timeweb settings, network, firewall, secret or password changes.
- No OpenAI billable request or budget activation.
- No worker/supervisor service activation.
- PR #89 remains draft and unmerged until reviewed and separately approved.

## Current CI prototype status (2026-11-17)

The disposable CI harness now implements and exercises:
- distinct LOGINs for SEO, QA, coordinator and supervisor;
- FORCE RLS on tasks, messages, runs, artifacts, approvals, budget config and task access;
- column-level grants instead of whole-table UPDATE;
- immutable routing/parent/creator columns for worker logins;
- scoped QA/coordinator access through narrowly parameterized SECURITY DEFINER test helpers;
- coordinator child creation only under a valid coordinator parent and for allowlisted specialist roles;
- pending-only approval creation, sender/task checks for messages, role/task checks for runs;
- negative checks for foreign task access, identity forgery, forbidden columns, DELETE, cross-parent evidence, GUC spoofing, SET ROLE, budget writes, approval decisions and unauthorized access grants.

The E2E test now executes actual coordinator, SEO, QA and supervisor processes using their separate CI PostgreSQL logins. Responses API output is deterministic and mocked in the test process; no HTTP request, API key, model spend or web search occurs. The test validates delegation, specialist completion, supervisor-issued QA access, QA PASS, and final consolidation.

The supervisor CLI acceptance suite now verifies:
- repeated supervisor passes do not create duplicate QA tasks;
- a completed QA task with no explicit PASS/REVISE verdict blocks the parent;
- expired worker leases are recovered and lease ownership is cleared;
- two concurrent supervisor processes create exactly one QA task and one scoped QA grant;
- QA REVISE blocks the parent and notifies the coordinator;
- exhausted specialist work in dead_letter blocks the parent and notifies the coordinator.

These tests run the actual supervisor CLI against disposable PostgreSQL using the distinct supervisor LOGIN. They do not yet cover every crash/restart boundary or all possible lease races.

**Important limits:** this is still a CI-only authorization harness, not a deployable runtime migration. The test helper functions are owned by the disposable CI database owner; production must use a dedicated non-login, narrowly privileged function owner with fixed search_path and reviewed grants. All 19 worker identities now have disposable CI LOGINs and are tested for own-task visibility and message-sender anti-spoofing; the separate operator approval CLI path is also exercised. These tests do not yet cover every worker/bus SQL command, every mutable column, DDL/sequence/unknown-login misuse, or all supervisor concurrency/restart/QA-revise paths. Production-grade function ownership and production RLS migration remain open. Do not copy this harness to a live database.
