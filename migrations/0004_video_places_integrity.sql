-- ============================================================================
-- MIGRACIÓN 0004: INTEGRIDAD REFERENCIAL DE LUGARES Y MÉTRICAS DE VIDEOS
-- ESTADO: MIGRACIÓN PENDIENTE (DOCUMENTADA EN AUDITORÍA - NO EJECUTAR EN VIVO)
-- ============================================================================
--
-- PROPÓSITO:
-- Reforzar la integridad de datos a nivel del motor relacional PostgreSQL (Neon)
-- para las relaciones entre publicaciones de video (video_submissions),
-- lugares del catálogo turístico (places) y tablas asociadas (video_places).
--
-- REQUISITOS PREVIOS:
-- 1. La migración 0002_places_catalog_schema.sql debe haber sido aplicada en Neon
--    para que la tabla "places" exista.
-- 2. Limpieza o validación de IDs huérfanos históricos en video_places.
--
-- ============================================================================

-- 1. CLAVE FORÁNEA: VINCULACIÓN ENTRE video_places Y places
-- Garantiza que ningún video pueda asociarse a un identificador de lugar inexistente
-- y que al eliminarse un lugar en cascada se limpien sus relaciones.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'places'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_video_places_place_id'
    ) THEN
        ALTER TABLE video_places
        ADD CONSTRAINT fk_video_places_place_id
        FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. ÍNDICE ÚNICO PARCIAL: GARANTÍA DE UN ÚNICO LUGAR PRINCIPAL POR VIDEO
-- A nivel relacional, impide que un error concurrente o de aplicación asigne
-- múltiples lugares principales (is_primary = TRUE) a un mismo video.
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_primary_place
ON video_places (video_id)
WHERE is_primary = TRUE;

-- 3. ÍNDICE COMPUESTO CUBRIENTE PARA CONSULTAS DE LUGARES Y VIDEOS
-- Optimiza consultas de videos por establecimiento (GET /api/places/:placeId/videos).
CREATE INDEX IF NOT EXISTS idx_video_places_place_composite
ON video_places (place_id, is_primary DESC, video_id);

-- 4. RESTRICCIONES CHECK DE NO-NEGATIVIDAD EN MÉTRICAS INTERNAS
-- Garantiza que internal_views_count e internal_saves_count nunca puedan ser negativos.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_internal_views_non_negative'
    ) THEN
        ALTER TABLE video_submissions
        ADD CONSTRAINT chk_internal_views_non_negative
        CHECK (internal_views_count >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_internal_saves_non_negative'
    ) THEN
        ALTER TABLE video_submissions
        ADD CONSTRAINT chk_internal_saves_non_negative
        CHECK (internal_saves_count >= 0);
    END IF;
END $$;
