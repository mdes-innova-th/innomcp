CREATE TABLE IF NOT EXISTS shell_executions (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  task_id      VARCHAR(64)  NULL,
  session_id   VARCHAR(64)  NULL,
  command      TEXT         NOT NULL,
  working_dir  VARCHAR(512) NOT NULL,
  exit_code    INT          NULL,
  stdout       TEXT         NULL,
  stderr       TEXT         NULL,
  risk_level   VARCHAR(16)  NOT NULL DEFAULT 'low',
  approved     TINYINT(1)   NOT NULL DEFAULT 1,
  duration_ms  INT          NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task (task_id),
  INDEX idx_session (session_id)
);
