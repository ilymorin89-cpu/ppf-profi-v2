CREATE TABLE IF NOT EXISTS agent_budget_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id=1),
  daily_cap_microusd BIGINT NOT NULL DEFAULT 0 CHECK (daily_cap_microusd >= 0),
  monthly_cap_microusd BIGINT NOT NULL DEFAULT 0 CHECK (monthly_cap_microusd >= 0),
  per_run_cap_microusd BIGINT NOT NULL DEFAULT 0 CHECK (per_run_cap_microusd >= 0),
  input_price_per_million_microusd BIGINT NOT NULL DEFAULT 0 CHECK (input_price_per_million_microusd >= 0),
  output_price_per_million_microusd BIGINT NOT NULL DEFAULT 0 CHECK (output_price_per_million_microusd >= 0),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO agent_budget_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS agent_runs_budget_daily_idx ON agent_runs (started_at) INCLUDE (cost_microusd);
