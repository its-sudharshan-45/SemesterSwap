-- SemesterSwap Phase 7 Payment Flow Redesign & Production Readiness
-- Migration SQL script to add new database fields and integrity constraints

-- 1. Update users table with future-ready student ID verification
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id_verified BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Add columns to purchase_requests for expiration and cancellation tracking
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- 3. Add columns to meetings for proposal stage and cancellation tracking
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ALTER COLUMN status SET DEFAULT 'PROPOSED';
