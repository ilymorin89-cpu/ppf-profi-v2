# Agent HQ — OpenAI runtime and ChatGPT control-plane plan

## Purpose

Use the OpenAI Responses API as the execution runtime for Agent HQ's 19 specialist roles. Use ChatGPT as the human-facing design, review and operating interface where the connected tools permit it. Do not treat a ChatGPT subscription as an API credential or assume this conversation is callable from the deployed service.

## Current implementation (repository state)

- `scripts/agent-hq-roles.mjs` defines 19 named roles and their Russian instructions.
- `scripts/agent-hq-worker.mjs` runs one assigned role per process and calls `POST /v1/responses`.
- `scripts/agent-hq-bus.mjs` stores tasks and inter-agent messages in PostgreSQL.
- Workers currently have three application function tools: `send_message`, `request_approval`, and coordinator-only `delegate_task`.
- The supervisor waits for specialist tasks and creates an independent QA task before closing a parent task.
- Workers are not 19 always-on autonomous services merely because 19 role definitions exist. A process manager and isolated deployment configuration are still required.
- Workers now have a gated built-in OpenAI web-search capability for selected research roles and a read-only project-file tool for a small allowlist of roles. No repository writes, shell, arbitrary browser navigation or production access are provided.

## Target architecture

1. **ChatGPT / owner interface:** define objectives, inspect evidence and approve restricted actions. ChatGPT is not silently embedded into the runtime; any app/connector integration must be built and explicitly connected.
2. **Coordinator role:** receives a bounded parent task, delegates specialist work, collects artifacts and asks for QA.
3. **19 role workers:** shared worker code, separate role identity/instructions and role-scoped capabilities. Start with one coordinator and a small worker pool; scale only after queue, lease and budget tests pass.
4. **PostgreSQL:** task queue, leases, messages, artifacts, approvals, usage ledger and audit history.
5. **Capability gateway:** server-side allowlisted tools. No arbitrary shell, arbitrary URL fetch, unrestricted database access, or production write access.
6. **Supervisor and QA:** recover expired leases, wait for specialists, require independent QA PASS and preserve evidence.

## OpenAI API capability policy

- Keep the Responses API as the model interface.
- The built-in `web_search` tool is a supported option for research roles, but it is NOT enabled in the current worker. It incurs tool usage charges and must not be enabled until search-call usage is separately accounted for in the budget ledger and role policy.
- Research-role candidates: `seo`, `geo`, `growth`, `analytics`, `content_seo`, `trend_scout`, `auto_news_editor`, `auto_law_monitor`, `fact_checker`, and `qa_security`.
- Repository editing should use a narrow GitHub capability with branch-only writes and pull-request review; do not expose general shell or production deployment.
- File access should be read-only by default, scoped to explicit project paths, with size limits and secret redaction.
- Any paid, external, irreversible, or production action must create an approval request and remain pending until an owner explicitly approves it.

## Required gates before live operation

1. Run role and worker unit tests locally.
2. Run queue concurrency, lease recovery, supervisor, QA and approval tests against a disposable PostgreSQL database only.
3. Prove daily, monthly and per-run budget reservation is concurrency-safe and that every billable tool cost is recorded, including web-search tool calls.
4. Add per-role tool allowlists and validate every tool argument server-side.
5. Add cancellation, timeout, retry and idempotency tests.
6. Verify secrets are supplied only through environment/secret storage and never logged or committed.
7. Deploy an isolated staging worker and staging database. Keep production worker count at zero until all gates pass.
8. Run a single manually approved, no-external-side-effects test task, then review its run, artifacts, messages, costs and QA verdict.

## Safety defaults

- No production database writes or migrations.
- No website publishing or deployment.
- No ads, spending, customer messages, public posts or external submissions.
- No OpenSEO paid operations unless separately approved and metered.
- No secrets in prompts, task payloads, artifacts or logs.
- Budget disabled by default; worker refuses to start if caps are missing or zero.

## Immediate implementation status

The current code is a useful orchestration foundation, not a finished autonomous 19-agent service. The latest branch changes add a guard against an unfinished final tool-call batch and validate bus sender/recipient/worker roles. GitHub Actions are unavailable due to exhausted quota, so these changes are not yet locally tested or CI-verified. Do not merge based on code inspection alone.

## Newly added restricted capabilities

### OpenAI web search

The worker exposes the Responses API `web_search` tool only when all of these are true:

- `AGENT_WEB_SEARCH_ENABLED=true`
- `AGENT_WEB_SEARCH_RESERVE_MICROUSD` is a positive integer in micro-USD
- The role is in the hard-coded research-role allowlist in `agent-hq-worker.mjs`

The worker reserves the configured per-search amount for up to four model turns before the run. It records the configured reserve for each returned `web_search_call` in the run ledger. This is a conservative configured estimate, not a provider invoice reconciliation; set the reserve above the current applicable per-call price and review actual billing separately. The feature remains off by default. Search usage pricing can change; consult current OpenAI pricing before enabling it.

### Read-only project files

Set `AGENT_PROJECT_ROOT` to the absolute project directory on the worker host. Only `coordinator`, `web_engineer`, `seo`, `qa_security`, and `fact_checker` receive `read_project_file`. It accepts normalized relative paths only, resolves symlinks, blocks traversal outside the root, allows a limited set of text extensions and rejects files larger than 64 KiB. It cannot write files, execute commands or read arbitrary absolute paths.

Example environment (do not copy a real secret into chat or source control):

```dotenv
AGENT_PROJECT_ROOT=/srv/ppf-profi
AGENT_WEB_SEARCH_ENABLED=false
# Set only after checking current OpenAI web-search pricing:
# AGENT_WEB_SEARCH_ENABLED=true
# AGENT_WEB_SEARCH_RESERVE_MICROUSD=<conservative-per-call-reserve>
```
