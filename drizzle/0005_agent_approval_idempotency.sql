CREATE UNIQUE INDEX IF NOT EXISTS agent_approvals_one_pending_action_idx
  ON agent_approvals (task_id, action)
  WHERE status = 'pending';
