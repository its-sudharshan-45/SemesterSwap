-- SemesterSwap Phase 4.1 Schema Migrations
-- Order Management Optimization & Production Readiness

-- 1. Add paid_at timestamp to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- 2. Add reserved_until timestamp to listings table
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP WITH TIME ZONE;
