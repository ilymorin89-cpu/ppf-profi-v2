-- Shared worker identity manifest for staging and disposable CI.
-- Runtime LOGIN roles must exist before migrations 0008 and 0009.
-- This file contains no passwords and does not start any workers.
-- Override worker_id_prefix with psql -v worker_id_prefix=<prefix>.
\if :{?worker_id_prefix}
\else
\set worker_id_prefix staging-
\endif

BEGIN;

CREATE TEMP TABLE expected_agent_hq_principals (
  login_role TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  worker_id TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO expected_agent_hq_principals (login_role, role, worker_id, enabled) VALUES
  ('agent_coordinator', 'coordinator', :'worker_id_prefix' || 'coordinator', true),
  ('agent_web_engineer', 'web_engineer', :'worker_id_prefix' || 'web_engineer', true),
  ('agent_seo', 'seo', :'worker_id_prefix' || 'seo', true),
  ('agent_geo', 'geo', :'worker_id_prefix' || 'geo', true),
  ('agent_growth', 'growth', :'worker_id_prefix' || 'growth', true),
  ('agent_analytics', 'analytics', :'worker_id_prefix' || 'analytics', true),
  ('agent_qa_security', 'qa_security', :'worker_id_prefix' || 'qa_security', true),
  ('agent_vk_strategist', 'vk_strategist', :'worker_id_prefix' || 'vk_strategist', true),
  ('agent_copywriter', 'copywriter', :'worker_id_prefix' || 'copywriter', true),
  ('agent_designer', 'designer', :'worker_id_prefix' || 'designer', true),
  ('agent_image_generator', 'image_generator', :'worker_id_prefix' || 'image_generator', true),
  ('agent_storyteller', 'storyteller', :'worker_id_prefix' || 'storyteller', true),
  ('agent_community_manager', 'community_manager', :'worker_id_prefix' || 'community_manager', true),
  ('agent_content_seo', 'content_seo', :'worker_id_prefix' || 'content_seo', true),
  ('agent_ads_manager', 'ads_manager', :'worker_id_prefix' || 'ads_manager', true),
  ('agent_trend_scout', 'trend_scout', :'worker_id_prefix' || 'trend_scout', true),
  ('agent_auto_news_editor', 'auto_news_editor', :'worker_id_prefix' || 'auto_news_editor', true),
  ('agent_auto_law_monitor', 'auto_law_monitor', :'worker_id_prefix' || 'auto_law_monitor', true),
  ('agent_fact_checker', 'fact_checker', :'worker_id_prefix' || 'fact_checker', true);

INSERT INTO public.agent_worker_principals (login_role, role, worker_id, enabled)
SELECT login_role, role, worker_id, enabled
FROM expected_agent_hq_principals
ORDER BY login_role
ON CONFLICT (login_role) DO NOTHING;

DO $assert_staging_workers$
BEGIN
  IF (SELECT count(*) FROM public.agent_worker_principals) <> 19 THEN
    RAISE EXCEPTION 'Expected exactly 19 worker principals; found %',
      (SELECT count(*) FROM public.agent_worker_principals);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expected_agent_hq_principals expected
    LEFT JOIN public.agent_worker_principals actual USING (login_role)
    WHERE actual.login_role IS NULL
       OR actual.role <> expected.role
       OR actual.worker_id <> expected.worker_id
       OR actual.enabled IS DISTINCT FROM expected.enabled
  ) THEN
    RAISE EXCEPTION 'A worker principal is missing or differs from the approved role/worker_id manifest';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expected_agent_hq_principals expected
    LEFT JOIN pg_roles r ON r.rolname=expected.login_role
    WHERE r.rolname IS NULL OR NOT r.rolcanlogin OR r.rolsuper
       OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolbypassrls
  ) THEN
    RAISE EXCEPTION 'Every worker principal must map to a safe NOINHERIT, non-superuser LOGIN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members m
    JOIN pg_roles member_role ON member_role.oid=m.member
    JOIN expected_agent_hq_principals expected ON expected.login_role=member_role.rolname
  ) THEN
    RAISE EXCEPTION 'Worker LOGINs must not belong to any PostgreSQL role';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname IN ('agent_supervisor','agent_operator')
      AND (NOT rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR
           rolinherit OR rolbypassrls)
  ) OR (SELECT count(*) FROM pg_roles
        WHERE rolname IN ('agent_supervisor','agent_operator')) <> 2 THEN
    RAISE EXCEPTION 'Supervisor and operator must be separate safe NOINHERIT LOGIN roles';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles member_role ON member_role.oid=m.member
    WHERE member_role.rolname IN ('agent_supervisor','agent_operator')
  ) THEN
    RAISE EXCEPTION 'Supervisor and operator LOGINs must not belong to any PostgreSQL role';
  END IF;

  IF EXISTS (
    SELECT 1 FROM expected_agent_hq_principals expected
    WHERE NOT has_database_privilege(expected.login_role, current_database(), 'CONNECT')
  ) OR NOT has_database_privilege('agent_supervisor', current_database(), 'CONNECT')
    OR NOT has_database_privilege('agent_operator', current_database(), 'CONNECT') THEN
    RAISE EXCEPTION 'All worker, supervisor and operator LOGINs must have CONNECT to this staging database';
  END IF;
END
$assert_staging_workers$;

COMMIT;
