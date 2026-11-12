-- =============================================================================
-- Migration 0006: Creator Audience Followers & Subscribers Schema
-- Module: Videos y Creadores (LibertadGO / Wayra)
-- Phase: 5 - Creator Audience Tracking & Popularity Sorting
-- Note: Documented for future production execution. Concurrently safe with IF NOT EXISTS.
-- =============================================================================

-- 1. Add audience metrics columns to creator_profiles
-- Self-declared audience metrics per platform (TikTok followers, Instagram followers, YouTube subscribers)
-- Allows NULL for unknown/undeclared; enforces non-negative integers (>= 0)
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS tiktok_followers INTEGER CHECK (tiktok_followers >= 0),
  ADD COLUMN IF NOT EXISTS instagram_followers INTEGER CHECK (instagram_followers >= 0),
  ADD COLUMN IF NOT EXISTS youtube_subscribers INTEGER CHECK (youtube_subscribers >= 0),
  ADD COLUMN IF NOT EXISTS audience_updated_at TIMESTAMPTZ;

-- 2. Performance indexes for popularity ranking & filter sorting
-- Nulls last ensures creators without declared audience appear at the end of the ranking
CREATE INDEX IF NOT EXISTS idx_creator_profiles_tiktok_followers
  ON creator_profiles (tiktok_followers DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_instagram_followers
  ON creator_profiles (instagram_followers DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_youtube_subscribers
  ON creator_profiles (youtube_subscribers DESC NULLS LAST);
