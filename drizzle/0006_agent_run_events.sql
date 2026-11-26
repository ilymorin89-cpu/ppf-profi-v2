CREATE TABLE IF NOT EXISTS agent_run_events (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  role VARCHAR(48) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  web_search_calls INTEGER NOT NULL DEFAULT 0 CHECK (web_search_calls >= 0),
  cost_microusd BIGINT NOT NULL DEFAULT 0 CHECK (cost_microusd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key VARCHAR(180) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_run_events_run_idx ON agent_run_events (run_id, created_at);
CREATE INDEX IF NOT EXISTS agent_run_events_daily_idx ON agent_run_events (created_at) INCLUDE (cost_microusd);
