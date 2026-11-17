-- Scoped cross-role visibility for coordinator oversight and independent QA.
-- This migration creates the access registry only. Runtime RLS enforcement is
-- intentionally deferred until each worker has a distinct PostgreSQL login.
CREATE TABLE IF NOT EXISTS agent_task_access (
  task_id BIGINT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  principal VARCHAR(48) NOT NULL,
  access_reason VARCHAR(32) NOT NULL
    CHECK (access_reason IN ('qa_review','coordinator_oversight')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, principal)
);
CREATE INDEX IF NOT EXISTS agent_task_access_principal_idx
  ON agent_task_access (principal, task_id);

 
-- Authenticated worker-instance registry. Each concurrent process must use its
-- own PostgreSQL LOGIN and a unique immutable worker_id. Credentials are
-- provisioned outside migrations; this table stores identity bindings only.
CREATE TABLE IF NOT EXISTS public.agent_worker_principals (
  login_role TEXT PRIMARY KEY,
  role VARCHAR(48) NOT NULL CHECK (role IN (
    'coordinator','web_engineer','seo','geo','growth','analytics','qa_security',
    'vk_strategist','copywriter','designer','image_generator','storyteller',
    'community_manager','content_seo','ads_manager','trend_scout',
    'auto_news_editor','auto_law_monitor','fact_checker'
  )),
  worker_id VARCHAR(120) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_worker_principals_login_name_check
    CHECK (login_role ~ '^agent_[a-z0-9_]+$'),
  CONSTRAINT agent_worker_principals_worker_id_check
    CHECK (length(worker_id) BETWEEN 1 AND 120)
);
REVOKE ALL ON public.agent_worker_principals FROM PUBLIC;
