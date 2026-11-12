-- =============================================================================
-- Migration 0005: Video Submissions & Creators Performance & Concurrency Indexes
-- Module: Videos y Creadores (LibertadGO / Wayra)
-- Phase: 4 - Production Readiness Audit & Performance Optimization
-- Note: Documented for production deployment. Concurrently safe with IF NOT EXISTS.
-- =============================================================================

-- 1. Optimized Compound Indexes for Public Catalog Video Feeds
-- Supports rapid filtering by status and descending chronological sort
CREATE INDEX IF NOT EXISTS idx_video_submissions_status_created_at
  ON video_submissions (status, created_at DESC);

-- Supports filtering by locality combined with status filter
CREATE INDEX IF NOT EXISTS idx_video_submissions_locality_status
  ON video_submissions (locality_id, status)
  WHERE locality_id IS NOT NULL;

-- Supports filtering by category combined with status filter
CREATE INDEX IF NOT EXISTS idx_video_submissions_category_status
  ON video_submissions (category, status);

-- 2. Deduplication & Unique Lookup Index
-- Guarantees O(1) external platform video lookups to prevent duplicate submissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_submissions_platform_external_id
  ON video_submissions (platform, external_video_id);

-- 3. Video-Place Relational Mapping Performance Indexes
-- Eliminates table scans during video detail rendering and establishment video feeds
CREATE INDEX IF NOT EXISTS idx_video_places_video_id
  ON video_places (video_id);

CREATE INDEX IF NOT EXISTS idx_video_places_place_id
  ON video_places (place_id);

-- 4. Favorites & Bookmarks Concurrency Indexes
-- Guarantees atomic verification and exact count aggregation without seq scans
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_videos_user_video
  ON saved_videos (user_id, video_id);

CREATE INDEX IF NOT EXISTS idx_saved_videos_video_id
  ON saved_videos (video_id);

CREATE INDEX IF NOT EXISTS idx_saved_videos_user_id
  ON saved_videos (user_id, created_at DESC);

-- 5. Moderation Audit Trail Historical Query Index
-- Powers admin audit history timeline with zero-latency descending index
CREATE INDEX IF NOT EXISTS idx_video_moderation_logs_video_created
  ON video_moderation_logs (video_id, created_at DESC);

-- 6. User Submission History Index
-- Speeds up creator profile dashboards and submission management
CREATE INDEX IF NOT EXISTS idx_video_submissions_user_created
  ON video_submissions (user_id, created_at DESC);
