-- 09-shell-user-id.sql
-- Adds user_id column to shell_executions for per-user audit trail.
-- Safe to run on existing installs: IF NOT EXISTS guard prevents errors.
-- Added alongside shell.ts optional-auth capture (Task 1 security fix).

ALTER TABLE shell_executions
  ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER session_id;
