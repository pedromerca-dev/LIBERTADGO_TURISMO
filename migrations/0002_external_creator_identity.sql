-- Migration 0002: External Creator Identity
-- Purpose: Add dedicated external creator attribution columns to video_submissions table.
-- NOTE: DO NOT EXECUTE AUTOMATICALLY. Keep documented until authorized for execution in Neon PostgreSQL.
-- In the interim, LibertadGO stores external creator identity in the existing `external_metrics` JSONB column.

ALTER TABLE video_submissions
  ADD COLUMN IF NOT EXISTS external_creator_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS external_creator_display_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS external_creator_avatar_url TEXT;

COMMENT ON COLUMN video_submissions.external_creator_handle IS 'External social creator username/handle on TikTok, Instagram, or YouTube (e.g. @viajerotrujillano) when creatorProfileId IS NULL';
COMMENT ON COLUMN video_submissions.external_creator_display_name IS 'External creator public display name (e.g. Viajero Trujillano)';
COMMENT ON COLUMN video_submissions.external_creator_avatar_url IS 'External creator profile avatar image URL';
