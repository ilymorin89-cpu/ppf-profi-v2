-- Install the runtime row-security boundary as part of the versioned migration chain.
-- Worker LOGINs (agent_<role>, agent_supervisor, agent_operator) must be provisioned
-- by the deployment's credential-management process before migrations 0008/0009.
-- Never put production passwords in migrations or test fixtures.

DO $owner$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_runtime_fn_owner') THEN
    CREATE ROLE agent_hq_runtime_fn_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  ALTER ROLE agent_hq_runtime_fn_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE r.rolname='agent_hq_runtime_fn_owner' OR member.rolname='agent_hq_runtime_fn_owner'
  ) THEN
    RAISE EXCEPTION 'agent_hq_runtime_fn_owner must not have or receive role memberships';
  END IF;
END
$owner$;

CREATE OR REPLACE FUNCTION public.agent_has_task_access(p_task_id BIGINT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $access$
  SELECT CASE session_user
    WHEN 'agent_qa_security' THEN EXISTS (
      SELECT 1 FROM public.agent_task_access a WHERE a.task_id=p_task_id AND a.principal='qa_security'
    )
    WHEN 'agent_coordinator' THEN EXISTS (
      SELECT 1 FROM public.agent_task_access a WHERE a.task_id=p_task_id AND a.principal='coordinator'
    )
    ELSE FALSE
  END
$access$;

CREATE OR REPLACE FUNCTION public.agent_can_grant_task_access(p_principal TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $grant_check$
  SELECT session_user='agent_supervisor' AND p_principal IN ('qa_security','coordinator')
$grant_check$;

CREATE OR REPLACE FUNCTION public.agent_is_valid_coordinator_parent(p_parent_task_id BIGINT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $parent_check$
  SELECT session_user='agent_coordinator' AND EXISTS (
    SELECT 1 FROM public.agent_tasks parent
    WHERE parent.id=p_parent_task_id
      AND parent.assigned_role='coordinator'
      AND parent.status IN ('claimed','running','review')
  )
$parent_check$;

GRANT SELECT ON public.agent_worker_principals TO agent_hq_runtime_fn_owner;
CREATE OR REPLACE FUNCTION public.agent_role_for_session()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $role_map$
  SELECT principal.role
  FROM public.agent_worker_principals principal
  WHERE principal.login_role=session_user::TEXT AND principal.enabled
$role_map$;

CREATE OR REPLACE FUNCTION public.agent_can_insert_own_artifact(p_task_id BIGINT,p_created_by TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $artifact_check$
  SELECT p_created_by=COALESCE(public.agent_role_for_session(),'__denied__')
    AND EXISTS (SELECT 1 FROM public.agent_tasks t
      WHERE t.id=p_task_id AND t.assigned_role=p_created_by)
$artifact_check$;

GRANT USAGE,CREATE ON SCHEMA public TO agent_hq_runtime_fn_owner;
GRANT SELECT ON public.agent_tasks,public.agent_task_access TO agent_hq_runtime_fn_owner;
ALTER FUNCTION public.agent_has_task_access(BIGINT) OWNER TO agent_hq_runtime_fn_owner;
ALTER FUNCTION public.agent_can_grant_task_access(TEXT) OWNER TO agent_hq_runtime_fn_owner;
ALTER FUNCTION public.agent_is_valid_coordinator_parent(BIGINT) OWNER TO agent_hq_runtime_fn_owner;
ALTER FUNCTION public.agent_role_for_session() OWNER TO agent_hq_runtime_fn_owner;
ALTER FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) OWNER TO agent_hq_runtime_fn_owner;
REVOKE CREATE ON SCHEMA public FROM agent_hq_runtime_fn_owner;

REVOKE ALL ON FUNCTION public.agent_has_task_access(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_can_grant_task_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_is_valid_coordinator_parent(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_role_for_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) FROM PUBLIC;

DO $grant_helpers$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator','agent_supervisor'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_has_task_access(BIGINT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) TO %I',role_name);
  END LOOP;
END
$grant_helpers$;
GRANT EXECUTE ON FUNCTION public.agent_can_grant_task_access(TEXT) TO agent_supervisor;
GRANT EXECUTE ON FUNCTION public.agent_is_valid_coordinator_parent(BIGINT) TO agent_coordinator,agent_supervisor;
DO $operator_connect$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO agent_operator',current_database());
END $operator_connect$;
GRANT USAGE ON SCHEMA public TO agent_operator;
GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO agent_operator,agent_supervisor;

-- The function owner receives only the reads needed by the SECURITY DEFINER helpers.
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_task_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_task_access FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_read_only ON public.agent_budget_config;
CREATE POLICY budget_read_only ON public.agent_budget_config FOR SELECT USING (true);

DROP POLICY IF EXISTS task_fn_owner_read ON public.agent_tasks;
CREATE POLICY task_fn_owner_read ON public.agent_tasks FOR SELECT TO agent_hq_runtime_fn_owner USING (true);
DROP POLICY IF EXISTS task_access_fn_owner_read ON public.agent_task_access;
CREATE POLICY task_access_fn_owner_read ON public.agent_task_access FOR SELECT TO agent_hq_runtime_fn_owner USING (true);

DROP POLICY IF EXISTS task_read_explicit_access ON public.agent_tasks;
CREATE POLICY task_read_explicit_access ON public.agent_tasks FOR SELECT USING (public.agent_has_task_access(id));
DROP POLICY IF EXISTS task_read_own_role ON public.agent_tasks;
CREATE POLICY task_read_own_role ON public.agent_tasks FOR SELECT USING (
  session_user='agent_supervisor' OR assigned_role=COALESCE(public.agent_role_for_session(),'__denied__')
);
DROP POLICY IF EXISTS task_update_own_role ON public.agent_tasks;
CREATE POLICY task_update_own_role ON public.agent_tasks FOR UPDATE USING (
  session_user='agent_supervisor' OR assigned_role=COALESCE(public.agent_role_for_session(),'__denied__')
) WITH CHECK (
  session_user='agent_supervisor' OR assigned_role=COALESCE(public.agent_role_for_session(),'__denied__')
);
DROP POLICY IF EXISTS task_insert_coordinator ON public.agent_tasks;
CREATE POLICY task_insert_coordinator ON public.agent_tasks FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    session_user='agent_coordinator' AND created_by='coordinator'
    AND assigned_role IN ('web_engineer','seo','geo','growth','analytics','qa_security','vk_strategist','copywriter','designer','image_generator','storyteller','community_manager','content_seo','ads_manager','trend_scout','auto_news_editor','auto_law_monitor','fact_checker')
    AND status='queued' AND attempts=0 AND lease_owner IS NULL AND lease_until IS NULL
    AND completed_at IS NULL AND parent_task_id IS NOT NULL
    AND public.agent_is_valid_coordinator_parent(parent_task_id)
  )
);

DROP POLICY IF EXISTS message_read_recipient ON public.agent_messages;
CREATE POLICY message_read_recipient ON public.agent_messages FOR SELECT USING (
  session_user='agent_supervisor' OR to_role=COALESCE(public.agent_role_for_session(),'__denied__')
);
DROP POLICY IF EXISTS message_insert_sender ON public.agent_messages;
CREATE POLICY message_insert_sender ON public.agent_messages FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    from_role=COALESCE(public.agent_role_for_session(),'__denied__')
    AND (task_id IS NULL OR EXISTS (
      SELECT 1 FROM public.agent_tasks t WHERE t.id=agent_messages.task_id AND t.assigned_role=from_role
    ))
  )
);

DROP POLICY IF EXISTS run_read_own_role ON public.agent_runs;
CREATE POLICY run_read_own_role ON public.agent_runs FOR SELECT USING (
  session_user='agent_supervisor' OR role=COALESCE(public.agent_role_for_session(),'__denied__')
);
DROP POLICY IF EXISTS run_insert_own_role ON public.agent_runs;
CREATE POLICY run_insert_own_role ON public.agent_runs FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    role=COALESCE(public.agent_role_for_session(),'__denied__') AND status='running'
    AND EXISTS (SELECT 1 FROM public.agent_tasks t WHERE t.id=agent_runs.task_id AND t.assigned_role=role)
  )
);
DROP POLICY IF EXISTS run_update_own_role ON public.agent_runs;
CREATE POLICY run_update_own_role ON public.agent_runs FOR UPDATE USING (
  session_user='agent_supervisor' OR role=COALESCE(public.agent_role_for_session(),'__denied__')
) WITH CHECK (
  session_user='agent_supervisor' OR role=COALESCE(public.agent_role_for_session(),'__denied__')
);

DROP POLICY IF EXISTS task_access_read_own ON public.agent_task_access;
CREATE POLICY task_access_read_own ON public.agent_task_access FOR SELECT USING (
  session_user='agent_supervisor' OR principal=COALESCE(public.agent_role_for_session(),'__denied__')
);
DROP POLICY IF EXISTS task_access_insert_supervisor ON public.agent_task_access;
CREATE POLICY task_access_insert_supervisor ON public.agent_task_access FOR INSERT
  WITH CHECK (public.agent_can_grant_task_access(principal));

DROP POLICY IF EXISTS artifact_read_explicit_access ON public.agent_artifacts;
CREATE POLICY artifact_read_explicit_access ON public.agent_artifacts FOR SELECT USING (
  public.agent_has_task_access(task_id)
);
DROP POLICY IF EXISTS artifact_read_own_task ON public.agent_artifacts;
CREATE POLICY artifact_read_own_task ON public.agent_artifacts FOR SELECT USING (
  session_user='agent_supervisor' OR EXISTS (
    SELECT 1 FROM public.agent_tasks t WHERE t.id=agent_artifacts.task_id
      AND t.assigned_role=COALESCE(public.agent_role_for_session(),'__denied__')
  )
);
DROP POLICY IF EXISTS artifact_insert_own_task ON public.agent_artifacts;
CREATE POLICY artifact_insert_own_task ON public.agent_artifacts FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR public.agent_can_insert_own_artifact(task_id,created_by)
);

DROP POLICY IF EXISTS approval_read_requester ON public.agent_approvals;
CREATE POLICY approval_read_requester ON public.agent_approvals FOR SELECT USING (
  CASE WHEN session_user IN ('agent_supervisor','agent_operator') THEN TRUE
    ELSE requested_by=COALESCE(public.agent_role_for_session(),'__denied__') END
);
DROP POLICY IF EXISTS approval_operator_read ON public.agent_approvals;
CREATE POLICY approval_operator_read ON public.agent_approvals FOR SELECT USING (session_user='agent_operator');
DROP POLICY IF EXISTS approval_operator_decide ON public.agent_approvals;
CREATE POLICY approval_operator_decide ON public.agent_approvals FOR UPDATE
  USING (session_user='agent_operator' AND status='pending')
  WITH CHECK (session_user='agent_operator' AND status IN ('approved','rejected')
    AND decided_by IS NOT NULL AND decided_at IS NOT NULL);
DROP POLICY IF EXISTS approval_insert_requester ON public.agent_approvals;
CREATE POLICY approval_insert_requester ON public.agent_approvals FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    status='pending' AND requested_by=COALESCE(public.agent_role_for_session(),'__denied__')
    AND EXISTS (SELECT 1 FROM public.agent_tasks t
      WHERE t.id=agent_approvals.task_id AND t.assigned_role=requested_by)
  )
);

-- Column-level privileges: no worker gets broad lifecycle or run mutation rights.
REVOKE ALL ON public.agent_tasks,public.agent_messages,public.agent_runs,
  public.agent_artifacts,public.agent_approvals,public.agent_task_access FROM PUBLIC;
DO $worker_grants$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator','agent_supervisor'
  ] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),role_name);
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I',role_name);
    EXECUTE format('GRANT SELECT ON public.agent_tasks,public.agent_messages,public.agent_runs,public.agent_artifacts,public.agent_approvals,public.agent_task_access,public.agent_budget_config TO %I',role_name);
    EXECUTE format('GRANT INSERT (task_id,conversation_id,from_role,to_role,kind,body,evidence,in_reply_to,idempotency_key) ON public.agent_messages TO %I',role_name);
    EXECUTE format('GRANT INSERT (task_id,created_by,artifact_type,title,content,evidence) ON public.agent_artifacts TO %I',role_name);
    EXECUTE format('GRANT INSERT (task_id,action,requested_by,payload,status) ON public.agent_approvals TO %I',role_name);
    EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE public.agent_messages_id_seq,public.agent_artifacts_id_seq,public.agent_approvals_id_seq TO %I',role_name);
  END LOOP;
END
$worker_grants$;

GRANT INSERT (parent_task_id,title,objective,expected_output,acceptance_criteria,assigned_role,status,priority,attempts,max_attempts,budget_limit_microusd,created_by)
  ON public.agent_tasks TO agent_coordinator,agent_supervisor;
GRANT UPDATE (status,attempts,lease_owner,lease_until,updated_at,completed_at)
  ON public.agent_tasks TO agent_supervisor;
GRANT INSERT (task_id,principal,access_reason) ON public.agent_task_access TO agent_supervisor;
GRANT SELECT (id,task_id,action,status,decided_by,decision_note,decided_at),
  UPDATE (status,decided_by,decision_note,decided_at) ON public.agent_approvals TO agent_operator;
GRANT USAGE,SELECT ON SEQUENCE public.agent_tasks_id_seq TO agent_coordinator,agent_supervisor;
REVOKE UPDATE ON public.agent_tasks FROM agent_operator;
REVOKE UPDATE (status,attempts,lease_owner,lease_until,updated_at,completed_at) ON public.agent_tasks FROM agent_operator;

DO $assert_roles$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator','agent_supervisor','agent_operator'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      RAISE EXCEPTION 'required Agent HQ LOGIN role % must be provisioned before migrations',role_name;
    END IF;
  END LOOP;
END
$assert_roles$;
