-- Disposable CI-only least-privilege harness. NEVER apply to a live database.
-- The CI database owner is the only seeding/cleanup identity.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_seo') THEN CREATE ROLE agent_seo LOGIN PASSWORD 'ci_agent_seo' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_qa_security') THEN CREATE ROLE agent_qa_security LOGIN PASSWORD 'ci_agent_qa' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_coordinator') THEN CREATE ROLE agent_coordinator LOGIN PASSWORD 'ci_agent_coordinator' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_supervisor') THEN CREATE ROLE agent_supervisor LOGIN PASSWORD 'ci_agent_supervisor' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END $$;

GRANT CONNECT ON DATABASE agent_hq_test TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT USAGE ON SCHEMA public TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

CREATE TABLE IF NOT EXISTS agent_task_access (
  task_id BIGINT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  principal VARCHAR(48) NOT NULL,
  access_reason VARCHAR(32) NOT NULL CHECK (access_reason IN ('qa_review','coordinator_oversight')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, principal)
);

-- Start from zero privileges. Never grant whole-table UPDATE to worker roles.
REVOKE ALL ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config,agent_task_access FROM PUBLIC;
REVOKE ALL ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config,agent_task_access FROM agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

GRANT SELECT ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT SELECT ON agent_task_access TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

-- Task state/lease fields only. Identity, routing, parent and budget fields are immutable to workers.
GRANT UPDATE (status,attempts,lease_owner,lease_until,updated_at,completed_at)
  ON agent_tasks TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT INSERT (parent_task_id,title,objective,expected_output,acceptance_criteria,assigned_role,status,priority,attempts,max_attempts,budget_limit_microusd,created_by)
  ON agent_tasks TO agent_coordinator,agent_supervisor;

GRANT INSERT (task_id,conversation_id,from_role,to_role,kind,body,evidence,in_reply_to,idempotency_key)
  ON agent_messages TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

GRANT INSERT (task_id,role,worker_id,provider,model,status,cost_microusd)
  ON agent_runs TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at)
  ON agent_runs TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

GRANT INSERT (task_id,created_by,artifact_type,title,content,evidence)
  ON agent_artifacts TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT INSERT (task_id,action,requested_by,payload,status)
  ON agent_approvals TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT INSERT (task_id,principal,access_reason) ON agent_task_access TO agent_supervisor;

GRANT USAGE,SELECT ON SEQUENCE agent_tasks_id_seq,agent_messages_id_seq,agent_runs_id_seq,agent_artifacts_id_seq,agent_approvals_id_seq
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_config FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_task_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_access FORCE ROW LEVEL SECURITY;

CREATE POLICY task_read_explicit_access ON agent_tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM agent_task_access access
    WHERE access.task_id=agent_tasks.id
      AND access.principal=CASE session_user
        WHEN 'agent_qa_security' THEN 'qa_security'
        WHEN 'agent_coordinator' THEN 'coordinator'
        WHEN 'agent_supervisor' THEN 'supervisor'
        ELSE '__denied__' END)
);
CREATE POLICY task_read_own_role ON agent_tasks FOR SELECT USING (
  session_user='agent_supervisor' OR assigned_role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
);
CREATE POLICY task_update_own_role ON agent_tasks FOR UPDATE USING (
  session_user='agent_supervisor' OR assigned_role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
) WITH CHECK (
  session_user='agent_supervisor' OR assigned_role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
);
CREATE POLICY task_insert_coordinator ON agent_tasks FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    session_user='agent_coordinator' AND created_by='coordinator'
    AND assigned_role IN ('web_engineer','seo','geo','growth','analytics','qa_security','vk_strategist','copywriter','designer','image_generator','storyteller','community_manager','content_seo','ads_manager','trend_scout','auto_news_editor','auto_law_monitor','fact_checker')
    AND status='queued' AND attempts=0 AND lease_owner IS NULL AND lease_until IS NULL
    AND completed_at IS NULL
    AND parent_task_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM agent_tasks parent
      WHERE parent.id=agent_tasks.parent_task_id
        AND parent.assigned_role='coordinator'
        AND parent.status IN ('claimed','running','review'))
  )
);

CREATE POLICY message_read_recipient ON agent_messages FOR SELECT USING (
  session_user='agent_supervisor' OR to_role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
);
CREATE POLICY message_insert_sender ON agent_messages FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    from_role = CASE session_user
      WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
      WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
    AND (task_id IS NULL OR EXISTS (SELECT 1 FROM agent_tasks t
      WHERE t.id=agent_messages.task_id AND t.assigned_role=from_role))
  )
);

CREATE POLICY run_read_own_role ON agent_runs FOR SELECT USING (
  session_user='agent_supervisor' OR role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
);
CREATE POLICY run_insert_own_role ON agent_runs FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    role = CASE session_user
      WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
      WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
    AND status='running'
    AND EXISTS (SELECT 1 FROM agent_tasks t WHERE t.id=agent_runs.task_id AND t.assigned_role=role)
  )
);
CREATE POLICY run_update_own_role ON agent_runs FOR UPDATE USING (
  session_user='agent_supervisor' OR role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
) WITH CHECK (
  session_user='agent_supervisor' OR role = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
);

CREATE POLICY task_access_read_own ON agent_task_access FOR SELECT USING (
  principal=CASE session_user
    WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator'
    WHEN 'agent_supervisor' THEN 'supervisor'
    ELSE '__denied__' END
);
CREATE POLICY task_access_insert_supervisor ON agent_task_access FOR INSERT
  WITH CHECK (session_user='agent_supervisor' AND principal IN ('qa_security','coordinator'));

CREATE POLICY artifact_read_explicit_access ON agent_artifacts FOR SELECT USING (
  EXISTS (SELECT 1 FROM agent_task_access access
    WHERE access.task_id=agent_artifacts.task_id
      AND access.principal=CASE session_user
        WHEN 'agent_qa_security' THEN 'qa_security'
        WHEN 'agent_coordinator' THEN 'coordinator'
        WHEN 'agent_supervisor' THEN 'supervisor'
        ELSE '__denied__' END)
);
CREATE POLICY artifact_read_own_task ON agent_artifacts FOR SELECT USING (
  session_user='agent_supervisor' OR EXISTS (
    SELECT 1 FROM agent_tasks t WHERE t.id=task_id AND t.assigned_role = CASE session_user
      WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
      WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
  )
);
CREATE POLICY artifact_insert_own_task ON agent_artifacts FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    created_by = CASE session_user
      WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
      WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
    AND EXISTS (SELECT 1 FROM agent_tasks t WHERE t.id=task_id AND t.assigned_role=created_by)
  )
);

CREATE POLICY approval_read_requester ON agent_approvals FOR SELECT USING (
  session_user='agent_supervisor' OR requested_by = CASE session_user
    WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
);
CREATE POLICY approval_insert_requester ON agent_approvals FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    status='pending'
    AND requested_by = CASE session_user
      WHEN 'agent_seo' THEN 'seo' WHEN 'agent_qa_security' THEN 'qa_security'
      WHEN 'agent_coordinator' THEN 'coordinator' ELSE '__denied__' END
    AND EXISTS (SELECT 1 FROM agent_tasks t WHERE t.id=agent_approvals.task_id AND t.assigned_role=requested_by)
  )
);
CREATE POLICY budget_read_only ON agent_budget_config FOR SELECT USING (true);
