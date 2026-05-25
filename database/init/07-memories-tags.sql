-- Phase 2 P2-5: add tag column to memories for search/filter
ALTER TABLE memories ADD COLUMN IF NOT EXISTS tag VARCHAR(64) NULL AFTER value;
ALTER TABLE memories ADD INDEX IF NOT EXISTS idx_tag (tag);
