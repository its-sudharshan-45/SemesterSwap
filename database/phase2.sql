-- SemesterSwap Phase 2 Database Schema

-- 10. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(listing_id, buyer_id)
);

-- 11. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 12. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 13. Create Wishlists Table
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, listing_id)
);

-- 14. Create Blocked Users Table
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

-- 15. Create Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Phase 2 Tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow select conversations for participants" ON public.conversations;
DROP POLICY IF EXISTS "Allow insert conversations for buyers" ON public.conversations;
DROP POLICY IF EXISTS "Allow update conversations for participants" ON public.conversations;
DROP POLICY IF EXISTS "Allow select messages for conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Allow insert messages for conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Allow update read status for message recipients" ON public.messages;
DROP POLICY IF EXISTS "Allow select notifications for owners" ON public.notifications;
DROP POLICY IF EXISTS "Allow update notifications for owners" ON public.notifications;
DROP POLICY IF EXISTS "Allow select wishlists for owners" ON public.wishlists;
DROP POLICY IF EXISTS "Allow insert wishlists for owners" ON public.wishlists;
DROP POLICY IF EXISTS "Allow delete wishlists for owners" ON public.wishlists;
DROP POLICY IF EXISTS "Allow select blocked_users for blocker" ON public.blocked_users;
DROP POLICY IF EXISTS "Allow insert blocked_users for blocker" ON public.blocked_users;
DROP POLICY IF EXISTS "Allow delete blocked_users for blocker" ON public.blocked_users;
DROP POLICY IF EXISTS "Allow select reports for reporters" ON public.reports;
DROP POLICY IF EXISTS "Allow insert reports for reporters" ON public.reports;

-- Create Conversations RLS Policies
CREATE POLICY "Allow select conversations for participants" ON public.conversations
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() OR (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid());

CREATE POLICY "Allow insert conversations for buyers" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid());

CREATE POLICY "Allow update conversations for participants" ON public.conversations
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() OR (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid());

-- Create Messages RLS Policies
CREATE POLICY "Allow select messages for conversation participants" ON public.messages
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)) = auth.uid() OR (SELECT auth_id FROM public.users WHERE id = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)) = auth.uid());

CREATE POLICY "Allow insert messages for conversation participants" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = sender_id) = auth.uid() AND ((SELECT auth_id FROM public.users WHERE id = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)) = auth.uid() OR (SELECT auth_id FROM public.users WHERE id = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)) = auth.uid()));

CREATE POLICY "Allow update read status for message recipients" ON public.messages
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)) = auth.uid() OR (SELECT auth_id FROM public.users WHERE id = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)) = auth.uid());

-- Create Notifications RLS Policies
CREATE POLICY "Allow select notifications for owners" ON public.notifications
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = auth.uid());

CREATE POLICY "Allow update notifications for owners" ON public.notifications
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = auth.uid());

-- Create Wishlists RLS Policies
CREATE POLICY "Allow select wishlists for owners" ON public.wishlists
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = auth.uid());

CREATE POLICY "Allow insert wishlists for owners" ON public.wishlists
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = user_id) = auth.uid());

CREATE POLICY "Allow delete wishlists for owners" ON public.wishlists
    FOR DELETE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = auth.uid());

-- Create Blocked Users RLS Policies
CREATE POLICY "Allow select blocked_users for blocker" ON public.blocked_users
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = blocker_id) = auth.uid());

CREATE POLICY "Allow insert blocked_users for blocker" ON public.blocked_users
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = blocker_id) = auth.uid());

CREATE POLICY "Allow delete blocked_users for blocker" ON public.blocked_users
    FOR DELETE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = blocker_id) = auth.uid());

-- Create Reports RLS Policies
CREATE POLICY "Allow select reports for reporters" ON public.reports
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = reporter_id) = auth.uid());

CREATE POLICY "Allow insert reports for reporters" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = reporter_id) = auth.uid());

-- Enable Supabase Realtime Replication on tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
