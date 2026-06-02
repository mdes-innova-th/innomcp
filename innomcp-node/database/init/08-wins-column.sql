-- 08-wins-column.sql
-- Adds wins column to provider_stats for synthesis winner tracking.
-- Safe to run on existing installs: IF NOT EXISTS guard prevents errors.
-- Added in Phase 22: motherDispatch.recordProviderWin() writes here async.

ALTER TABLE provider_stats
  ADD COLUMN IF NOT EXISTS wins INT NOT NULL DEFAULT 0;

-- Ensure the index on requests still covers the new column's sort order
-- (no index change needed — wins is tracked separately from requests)
