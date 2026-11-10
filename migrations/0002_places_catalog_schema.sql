-- ====================================================================
-- LIBERTADGO: MIGRATION 0002 - CATÁLOGO DE LUGARES TURÍSTICOS Y AUDITORÍA
-- Dialecto: PostgreSQL 14+
-- Alcance: La Libertad, Perú
-- ====================================================================

-- 1. TABLA PRINCIPAL DE LUGARES TURÍSTICOS
CREATE TABLE IF NOT EXISTS places (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(150) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  locality_id VARCHAR(50) NOT NULL,
  locality_name VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geohash VARCHAR(20),
  description TEXT,
  short_description TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  website TEXT,
  maps_url TEXT,
  google_place_id VARCHAR(100),
  price_level SMALLINT CHECK (price_level BETWEEN 1 AND 4),
  rating NUMERIC(3, 2),
  reviews_count INTEGER DEFAULT 0,
  recommended_duration_minutes INTEGER,
  tags TEXT[],
  safety_data JSONB,
  prediction_data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'FLAGGED', 'PUBLISHED', 'ARCHIVED')),
  verification_level VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (verification_level IN ('unverified', 'community', 'official_mincetur', 'partner_verified')),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_slug ON places(slug);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_locality_id ON places(locality_id);
CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_is_verified ON places(is_verified);
CREATE INDEX IF NOT EXISTS idx_places_coords ON places(latitude, longitude);

-- 2. TABLA DE IMÁGENES DE LUGARES
CREATE TABLE IF NOT EXISTS place_images (
  id VARCHAR(64) PRIMARY KEY,
  place_id VARCHAR(64) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  author VARCHAR(100),
  license VARCHAR(100),
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_images_place_id ON place_images(place_id);

-- 3. TABLA DE FUENTES DE INFORMACIÓN Y TRAZABILIDAD
CREATE TABLE IF NOT EXISTS place_sources (
  id VARCHAR(64) PRIMARY KEY,
  place_id VARCHAR(64) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  source_id VARCHAR(50) NOT NULL,
  external_id VARCHAR(100) NOT NULL,
  raw_data_ref TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_place_source_external UNIQUE (place_id, source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_place_sources_place_id ON place_sources(place_id);
CREATE INDEX IF NOT EXISTS idx_place_sources_source_id ON place_sources(source_id);

-- 4. TABLA DE HORARIOS DE ATENCIÓN
CREATE TABLE IF NOT EXISTS place_opening_hours (
  id VARCHAR(64) PRIMARY KEY,
  place_id VARCHAR(64) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time VARCHAR(10) NOT NULL,
  close_time VARCHAR(10) NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_place_hours_place_id ON place_opening_hours(place_id);

-- 5. TABLA INMUTABLE DE AUDITORÍA Y TRAZABILIDAD ADMINISTRATIVA
CREATE TABLE IF NOT EXISTS place_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  place_id VARCHAR(64) NOT NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (actor_type IN ('ADMIN', 'SYSTEM')),
  admin_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  admin_name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'VERIFY', 'MERGE', 'ARCHIVE')),
  previous_data JSONB,
  new_data JSONB,
  change_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_audit_place_id ON place_audit_log(place_id);
CREATE INDEX IF NOT EXISTS idx_place_audit_actor_type ON place_audit_log(actor_type);
CREATE INDEX IF NOT EXISTS idx_place_audit_created_at ON place_audit_log(created_at DESC);

-- 6. TABLA DE REVOCACIÓN DE TOKENS DE SESIÓN (HASH SHA-256)
CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user_id ON revoked_tokens(user_id);
