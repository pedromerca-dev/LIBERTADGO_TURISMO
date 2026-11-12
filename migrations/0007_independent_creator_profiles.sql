
BEGIN;

-- 1. Permitir perfiles sin una cuenta de usuario.
ALTER TABLE public.creator_profiles
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Eliminar la restricción UNIQUE global anterior.
ALTER TABLE public.creator_profiles
DROP CONSTRAINT creator_profiles_user_id_key;

-- 3. Mantener unicidad únicamente cuando user_id tenga valor.
CREATE UNIQUE INDEX creator_profiles_user_id_unique_not_null_idx
ON public.creator_profiles (user_id)
WHERE user_id IS NOT NULL;

COMMIT;
