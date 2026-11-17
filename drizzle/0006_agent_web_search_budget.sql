ALTER TABLE agent_budget_config
  ADD COLUMN IF NOT EXISTS web_search_price_microusd_per_call BIGINT NOT NULL DEFAULT 0
  CHECK (web_search_price_microusd_per_call >= 0);
