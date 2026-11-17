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
