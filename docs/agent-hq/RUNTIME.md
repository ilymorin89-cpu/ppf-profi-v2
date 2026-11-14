# Agent HQ runtime skeleton

This branch adds the first executable transport layer. It is not yet an autonomous LLM runtime and is not deployed.

## Files
- `drizzle/0003_agent_hq.sql`: durable tables for tasks, messages, runs, artifacts and approvals.
- `scripts/agent-hq-bus.mjs`: CLI to enqueue tasks, send role-to-role messages, inspect an inbox and claim queued tasks with PostgreSQL `FOR UPDATE SKIP LOCKED`.
- `package.json`: `npm run agent-hq -- <command>` convenience script.

## Safe setup
1. Back up the PostgreSQL database.
2. Apply `drizzle/0003_agent_hq.sql` manually in a non-production/staging database first. Do not run it against production until reviewed and approved.
3. Set `DATABASE_URL` only in the worker's server environment. Never put it in Git, chat messages or logs.
4. Install project dependencies, then run commands below.

## Commands
```bash
npm run agent-hq -- enqueue seo 'Audit crawlability' 'Check robots, sitemap and key URLs; return evidence.'
npm run agent-hq -- send seo web_engineer 1 request 'Please inspect the 503 response for this URL.'
npm run agent-hq -- inbox web_engineer
npm run agent-hq -- claim seo seo-worker-01
```

`claim` returns one task and marks it claimed for a three-minute lease. This initial CLI does not yet heartbeat, complete tasks, run model inference, or recover expired leases automatically. Those are the next runtime steps; do not use it as a production worker yet.

## Verification status
Static review only. No database connection was made, no migration was applied, no live task was created, and no worker process was launched. These actions require a staging database and explicit deployment approval.

## Next increments
1. Add lease renewal, completion/failure transitions, retry recovery and dead-letter processing.
2. Add provider adapter (OpenAI or another selected provider) with strict per-role tool allowlists and per-run cost caps.
3. Add role-specific worker processes and coordinator loop.
4. Add QA objection/revision loop and owner approval queue.
5. Add automated tests for concurrent claims, idempotency, retries and lease expiry.
6. Deploy separately from the public Next.js website after staging validation.