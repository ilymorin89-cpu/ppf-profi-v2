# OpenSEO MCP Adapter — staged integration

## Purpose

Expose OpenSEO MCP to Agent HQ workers through a small server-side adapter. Agent HQ remains the coordinator; OpenSEO remains an external SEO data/tool provider.

## Verified connection contract

- Hosted MCP endpoint: `https://app.openseo.so/mcp`
- Transport: Streamable HTTP (JSON-RPC 2.0)
- Authentication: `Authorization: Bearer <OpenSEO API key>`
- API key prefix: `oseo_`; create it in OpenSEO Settings → API keys. It is shown once.
- The API key acts with the privileges of the active OpenSEO workspace. Never commit it, put it in task payloads, or print it to logs.
- Required environment variables: `OPENSEO_API_KEY`, `OPENSEO_PROJECT_ID`; optional `OPENSEO_MCP_URL`.

## Stage 1 — adapter only

`scripts/openseo-mcp-client.mjs` implements MCP initialize, initialized notification, tools/list and tools/call. It pins every call to `OPENSEO_PROJECT_ID`, requires HTTPS for remote endpoints, and defaults to an explicit read-only tool allowlist. Mutating tools are blocked regardless of allowlist configuration.

The allowlist intentionally contains account/project context, Search Console and Analytics read methods only. It excludes keyword/competitor/AI visibility research, crawling, rank tracking, saving, scheduling, publishing and all other operations until their costs and permissions are reviewed.

## Stage 2 — gated worker integration (not enabled yet)

Before wiring this into `agent-hq-worker.mjs`:

1. Owner creates an OpenSEO API key in the correct workspace and stores it as a server secret, not in GitHub source or task content.
2. Confirm project ID and Russia/Russian targeting configuration in OpenSEO.
3. Add an Agent HQ capability policy mapping roles to specific MCP tool names. Start with `seo`, `analytics`, `geo` and `qa_security`; all others receive no OpenSEO access.
4. Add per-tool argument schemas, project pinning, timeout, response-size limits, redaction and audit events.
5. Paid calls must require an explicit owner-approved task budget and use the tool's `dry_run` and `max_cost_usd` contract before execution. No default spend ceiling is inferred.
6. Mutations (saving keywords, changing context, scheduling, index submission, report sharing/deletion) stay disabled until separately approved.
7. Add integration tests against an isolated MCP fixture, then verify the hosted endpoint using a secret supplied through the deployment environment.
8. Only after tests pass, wire into worker tool routing behind a feature flag, initially disabled.

## Current limitations

- This commit does not contain credentials and does not make a live OpenSEO connection.
- It does not enable workers, background jobs, paid research or production changes.
- OpenSEO Skills are reusable workflows/instructions, not twelve separate persistent worker processes. Agent HQ can orchestrate them as task templates once tool access is safely available.
- The MCP tool list may evolve; use server `tools/list` and an explicit local allowlist rather than assuming every server tool is safe.
