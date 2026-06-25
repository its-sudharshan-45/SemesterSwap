-- SemesterSwap Phase 8: Remove Admin Module & Convert to User-Only Architecture
-- Migration SQL script to clean up admin structures

-- 1. Drop chk_user_role constraint and role column from users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_user_role;
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- 2. Drop meeting_locations table
DROP TABLE IF EXISTS public.meeting_locations CASCADE;
