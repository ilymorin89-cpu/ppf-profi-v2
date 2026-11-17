# Agent HQ worker identity provisioning

## Security contract

Each concurrently running worker process must authenticate with its own PostgreSQL LOGIN. The LOGIN name is registered in `public.agent_worker_principals` with one logical role and one unique immutable worker ID.

The worker process does not choose its identity. At startup it reads:

- `session_user` — authenticated PostgreSQL LOGIN;
- `agent_role_for_session()` — role mapped by the trusted registry;
- `agent_worker_id_for_session()` — immutable worker ID mapped by the trusted registry.

`AGENT_ROLE` is a configuration assertion and must match the database mapping. `AGENT_WORKER_ID` is optional and, when supplied, is only checked against the database value; it is never trusted as the identity source.

The trusted budget and lease functions reject any caller-supplied worker ID that differs from the registry value. A worker cannot read or modify the registry. It cannot claim a lease, heartbeat, settle, release or mark unknown using another worker's identity.

## Provisioning one worker instance

Run the following as a dedicated database provisioning administrator after migrations 0003–0010. Replace the example login and worker ID. Supply the password from a secret manager or a secure interactive process; never commit it to the repository, a migration, a shell history or CI artifacts.

Example for a second SEO process:

```sql
CREATE ROLE agent_seo_worker_02
  LOGIN PASSWORD '<INJECT_FROM_SECRET_MANAGER>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

GRANT CONNECT ON DATABASE agent_hq TO agent_seo_worker_02;
GRANT USAGE ON SCHEMA public TO agent_seo_worker_02;

GRANT SELECT ON public.agent_tasks,public.agent_messages,public.agent_runs,
  public.agent_artifacts,public.agent_approvals,public.agent_task_access,
  public.agent_budget_config TO agent_seo_worker_02;

GRANT INSERT (task_id,conversation_id,from_role,to_role,kind,body,evidence,in_reply_to,idempotency_key)
  ON public.agent_messages TO agent_seo_worker_02;
GRANT INSERT (task_id,created_by,artifact_type,title,content,evidence)
  ON public.agent_artifacts TO agent_seo_worker_02;
GRANT INSERT (task_id,action,requested_by,payload,status)
  ON public.agent_approvals TO agent_seo_worker_02;
GRANT USAGE,SELECT ON SEQUENCE public.agent_messages_id_seq,
  public.agent_artifacts_id_seq,public.agent_approvals_id_seq TO agent_seo_worker_02;

GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_worker_id_for_session() TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_task_claim(TEXT) TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT)
  TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_budget_settle(BIGINT,TEXT,INTEGER,INTEGER,INTEGER,TEXT,TEXT)
  TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT,TEXT)
  TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT,TEXT)
  TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_task_heartbeat(BIGINT,TEXT) TO agent_seo_worker_02;
GRANT EXECUTE ON FUNCTION public.agent_task_transition(BIGINT,TEXT,TEXT,BIGINT) TO agent_seo_worker_02;

INSERT INTO public.agent_worker_principals(login_role,role,worker_id,enabled)
VALUES ('agent_seo_worker_02','seo','seo-worker-02',true);
```

The example database name `agent_hq` must be replaced with the actual Agent HQ database name. The SQL above is a provisioning reference, not a migration and not a command to run against production without the normal approval/change process.

## Runtime configuration

For this instance:

- `AGENT_ROLE=seo`
- `DATABASE_URL` must authenticate as `agent_seo_worker_02`
- `AGENT_WORKER_ID=seo-worker-02` may be supplied as a consistency check, or omitted

Do not reuse this LOGIN for another process. A second concurrent SEO worker gets a different LOGIN and a different `worker_id`. Never grant worker LOGINs membership in another worker role, supervisor, operator, or either SECURITY DEFINER owner role.

## Verification

As the worker LOGIN, verify:

```sql
SELECT session_user,
       public.agent_role_for_session() AS mapped_role,
       public.agent_worker_id_for_session() AS mapped_worker_id;
```

Expected result must exactly match the registered LOGIN, logical role and worker ID.

These must fail with SQLSTATE `42501`:

- selecting, inserting, updating or deleting `agent_worker_principals`;
- calling `agent_task_claim` with a different worker ID;
- calling reserve/settle/release/unknown/heartbeat/transition with another worker's ID;
- attempting `SET ROLE` to another worker, supervisor, operator or function-owner role.

CI uses fixed disposable credentials and one LOGIN per logical role. Those credentials are test fixtures only and must never be copied to production.
