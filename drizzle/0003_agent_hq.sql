CREATE TABLE IF NOT EXISTS agent_tasks (
  id BIGSERIAL PRIMARY KEY,
  parent_task_id BIGINT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  title VARCHAR(240) NOT NULL,
  objective TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_role VARCHAR(48) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  budget_limit_microusd BIGINT NOT NULL DEFAULT 0,
  lease_owner VARCHAR(120),
  lease_until TIMESTAMPTZ,
  created_by VARCHAR(48) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT agent_tasks_status_check CHECK (status IN ('queued','claimed','running','review','done','blocked','cancelled','dead_letter'))
);
CREATE INDEX IF NOT EXISTS agent_tasks_queue_idx ON agent_tasks (assigned_role, priority, created_at) WHERE status='queued';
CREATE INDEX IF NOT EXISTS agent_tasks_lease_idx ON agent_tasks (lease_until) WHERE status IN ('claimed','running');

CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  conversation_id UUID NOT NULL,
  from_role VARCHAR(48) NOT NULL,
  to_role VARCHAR(48) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  body TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  in_reply_to BIGINT REFERENCES agent_messages(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_messages_kind_check CHECK (kind IN ('request','result','question','objection','handoff','approval_request','status'))
);
CREATE INDEX IF NOT EXISTS agent_messages_inbox_idx ON agent_messages (to_role, created_at);

CREATE TABLE IF NOT EXISTS agent_runs (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  role VARCHAR(48) NOT NULL,
  worker_id VARCHAR(120) NOT NULL,
  provider VARCHAR(80),
  model VARCHAR(120),
  status VARCHAR(24) NOT NULL DEFAULT 'running',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_microusd BIGINT NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT agent_runs_status_check CHECK (status IN ('running','succeeded','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS agent_runs_task_idx ON agent_runs (task_id, started_at DESC);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  created_by VARCHAR(48) NOT NULL,
  artifact_type VARCHAR(40) NOT NULL,
  title VARCHAR(240) NOT NULL,
  content TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  requested_by VARCHAR(48) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  decided_by VARCHAR(80),
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT agent_approvals_status_check CHECK (status IN ('pending','approved','rejected'))
);
