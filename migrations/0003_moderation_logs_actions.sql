-- Migration 0003: Moderation Logs Action Types and Changed Fields
-- Purpose: Add dedicated action and changed_fields columns to video_moderation_logs,
-- and allow previous_status to be NULL for direct creation (CREATE) actions.
-- NOTE: DO NOT EXECUTE AUTOMATICALLY. Keep documented until authorized for execution in Neon PostgreSQL.
-- In the interim, LibertadGO encodes action and changed_fields metadata in internal_notes and previous_status='NONE'.

ALTER TABLE video_moderation_logs
  ADD COLUMN IF NOT EXISTS action VARCHAR(20) NOT NULL DEFAULT 'UPDATE',
  ADD COLUMN IF NOT EXISTS changed_fields JSONB,
  ALTER COLUMN previous_status DROP NOT NULL;

COMMENT ON COLUMN video_moderation_logs.action IS 'Audited action type: CREATE, UPDATE, APPROVE, REJECT, OBSERVE, HIDE';
COMMENT ON COLUMN video_moderation_logs.changed_fields IS 'JSON array of modified attribute names during UPDATE actions';
