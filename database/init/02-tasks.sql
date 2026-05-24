-- Migration 02: Task persistence for Manus-style task history
-- Run after 01-tables.sql

CREATE TABLE IF NOT EXISTS tasks (
  id            VARCHAR(64)   NOT NULL,
  user_id       INT           NULL,
  run_id        VARCHAR(64)   NOT NULL DEFAULT '',
  title         VARCHAR(255)  NOT NULL DEFAULT '',
  intent        VARCHAR(64)   NOT NULL DEFAULT 'general',
  status        ENUM('running','completed','failed') NOT NULL DEFAULT 'running',
  elapsed_ms    INT           NULL,
  final_answer  TEXT          NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at  DATETIME      NULL,
  PRIMARY KEY (id),
  INDEX idx_tasks_user_created (user_id, created_at DESC),
  INDEX idx_tasks_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_steps (
  id            INT           NOT NULL AUTO_INCREMENT,
  task_id       VARCHAR(64)   NOT NULL,
  event_type    VARCHAR(64)   NOT NULL,
  public_summary TEXT         NOT NULL DEFAULT '',
  agent_id      VARCHAR(64)   NULL,
  tool_name     VARCHAR(64)   NULL,
  ts            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_task_steps_task (task_id),
  CONSTRAINT fk_task_steps_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
