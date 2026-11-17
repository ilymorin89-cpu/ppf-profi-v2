-- Bind every worker process to its authenticated PostgreSQL LOGIN.
-- Provision one distinct LOGIN per concurrently running worker instance and
-- register that LOGIN here using the deployment's credential-management path.
-- Never share a LOGIN between worker processes; never store passwords here.

DO $owner$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_runtime_fn_owner') THEN
    RAISE EXCEPTION 'agent_hq_runtime_fn_owner must exist before worker identity migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE r.rolname='agent_hq_runtime_fn_owner' OR member.rolname='agent_hq_runtime_fn_owner'
  ) THEN
    RAISE EXCEPTION 'runtime function owner must not have or receive role memberships';
  END IF;
END
$owner$;

ALTER TABLE public.agent_worker_principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_worker_principals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS worker_principal_budget_owner_read ON public.agent_worker_principals;
CREATE POLICY worker_principal_budget_owner_read ON public.agent_worker_principals
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS worker_principal_runtime_owner_read ON public.agent_worker_principals;
CREATE POLICY worker_principal_runtime_owner_read ON public.agent_worker_principals
  FOR SELECT TO agent_hq_runtime_fn_owner USING (true);

GRANT SELECT ON public.agent_worker_principals TO agent_hq_budget_owner,agent_hq_runtime_fn_owner;
REVOKE ALL ON public.agent_worker_principals FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.agent_worker_id_for_session()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $worker_identity$
  SELECT principal.worker_id
  FROM public.agent_worker_principals principal
  WHERE principal.login_role=session_user::TEXT AND principal.enabled
$worker_identity$;

ALTER FUNCTION public.agent_worker_id_for_session() OWNER TO agent_hq_runtime_fn_owner;
REVOKE ALL ON FUNCTION public.agent_worker_id_for_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_worker_id_for_session() TO agent_hq_budget_owner;

DO $worker_exec$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_worker_id_for_session() TO %I',role_name);
  END LOOP;
END
$worker_exec$;

-- Only trusted deployment provisioning may insert/update this registry. Worker
-- LOGINs have no direct table privileges and cannot self-register or impersonate.
