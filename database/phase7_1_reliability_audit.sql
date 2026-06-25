-- SemesterSwap Phase 7.1 Transaction Reliability, Audit, Automation & Hardening
-- Migration SQL script to add new database tables, fields, and integrity constraints

-- 1. Add role column to users table with STUDENT/ADMIN check constraint
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'STUDENT' NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_user_role;
ALTER TABLE public.users ADD CONSTRAINT chk_user_role CHECK (role IN ('STUDENT', 'ADMIN'));

-- 2. Add read_at column to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 3. Create security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Create meeting_locations table supporting soft delete
CREATE TABLE IF NOT EXISTS public.meeting_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Create transaction_audit_logs table
CREATE TABLE IF NOT EXISTS public.transaction_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_request_id UUID REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_audit_action CHECK (action_type IN ('REQUEST_CREATED', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED', 'REQUEST_CANCELLED', 'MEETING_RESCHEDULED', 'BUYER_CONFIRMED', 'SELLER_CONFIRMED', 'COMPLETED', 'NO_SHOW_MARKED'))
);

-- 6. Add confirmation_deadline and no_show_marked_at to meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMP WITH TIME ZONE;

-- 7. Database level integrity constraints
-- 7a. Prevent self-purchase
ALTER TABLE public.purchase_requests DROP CONSTRAINT IF EXISTS chk_buyer_seller_diff;
ALTER TABLE public.purchase_requests ADD CONSTRAINT chk_buyer_seller_diff CHECK (buyer_id <> seller_id);

-- 7b. Restrict payment method
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS chk_payment_method;
ALTER TABLE public.meetings ADD CONSTRAINT chk_payment_method CHECK (payment_method IN ('CASH', 'UPI'));

-- 7c. Ensure unique confirmation record per meeting
ALTER TABLE public.transaction_confirmations DROP CONSTRAINT IF EXISTS uq_meeting_id;
ALTER TABLE public.transaction_confirmations ADD CONSTRAINT uq_meeting_id UNIQUE (meeting_id);

-- 8. Pre-populate dynamic campus coordinates
INSERT INTO public.meeting_locations (name, description, is_active) VALUES
('Library Entrance', 'The main entrance lobby of the central campus library', TRUE),
('CSE Block Lobby', 'Ground floor waiting area of the CSE block', TRUE),
('Main Gate', 'Security checkpoint at the campus main entrance', TRUE),
('Campus Cafeteria', 'Central seating area inside the main campus dining cafeteria', TRUE),
('Student Activity Center', 'Main lobby of the student recreational center', TRUE)
ON CONFLICT (name) DO NOTHING;
