-- CI uses the shared, fail-closed staging worker manifest with disposable test IDs.
\set worker_id_prefix test-
\ir ../scripts/agent-hq-staging-register-workers.sql
