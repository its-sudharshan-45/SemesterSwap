-- =============================================================================
-- SemesterSwap — Phase 9 RLS Performance Optimization
-- Optimizes RLS policies by wrapping auth.uid() and auth.role() in (SELECT ...)
-- to prevent row-by-row re-evaluation and resolve Supabase linter warnings.
-- =============================================================================

-- 1. Optimize public.users policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT TO authenticated USING ((select auth.uid()) = auth_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE TO authenticated USING ((select auth.uid()) = auth_id) WITH CHECK ((select auth.uid()) = auth_id);

-- 2. Optimize public.listings policies
DROP POLICY IF EXISTS "Allow select listings for everyone" ON public.listings;
CREATE POLICY "Allow select listings for everyone" ON public.listings
    FOR SELECT TO public
    USING (status = 'available' OR ((select auth.role()) = 'authenticated' AND (SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid())));

DROP POLICY IF EXISTS "Allow insert listings for authenticated users" ON public.listings;
CREATE POLICY "Allow insert listings for authenticated users" ON public.listings
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow update listings for owners" ON public.listings;
CREATE POLICY "Allow update listings for owners" ON public.listings
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid()))
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow delete listings for owners" ON public.listings;
CREATE POLICY "Allow delete listings for owners" ON public.listings
    FOR DELETE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid()));

-- 3. Optimize public.conversations policies
DROP POLICY IF EXISTS "Allow select conversations for participants" ON public.conversations;
CREATE POLICY "Allow select conversations for participants" ON public.conversations
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = buyer_id) = (select auth.uid()) OR (SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow insert conversations for buyers" ON public.conversations;
CREATE POLICY "Allow insert conversations for buyers" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = buyer_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow update conversations for participants" ON public.conversations;
CREATE POLICY "Allow update conversations for participants" ON public.conversations
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = buyer_id) = (select auth.uid()) OR (SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid()));

-- 4. Optimize public.messages policies
DROP POLICY IF EXISTS "Allow select messages for conversation participants" ON public.messages;
CREATE POLICY "Allow select messages for conversation participants" ON public.messages
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)) = (select auth.uid()) OR (SELECT auth_id FROM public.users WHERE id = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow insert messages for conversation participants" ON public.messages;
CREATE POLICY "Allow insert messages for conversation participants" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = sender_id) = (select auth.uid()) AND ((SELECT auth_id FROM public.users WHERE id = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)) = (select auth.uid()) OR (SELECT auth_id FROM public.users WHERE id = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)) = (select auth.uid())));

DROP POLICY IF EXISTS "Allow update read status for message recipients" ON public.messages;
CREATE POLICY "Allow update read status for message recipients" ON public.messages
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)) = (select auth.uid()) OR (SELECT auth_id FROM public.users WHERE id = (SELECT seller_id FROM public.conversations WHERE id = conversation_id)) = (select auth.uid()));

-- 5. Optimize public.notifications policies
DROP POLICY IF EXISTS "Allow select notifications for owners" ON public.notifications;
CREATE POLICY "Allow select notifications for owners" ON public.notifications
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow update notifications for owners" ON public.notifications;
CREATE POLICY "Allow update notifications for owners" ON public.notifications
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = (select auth.uid()));

-- 6. Optimize public.wishlists policies
DROP POLICY IF EXISTS "Allow select wishlists for owners" ON public.wishlists;
CREATE POLICY "Allow select wishlists for owners" ON public.wishlists
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow insert wishlists for owners" ON public.wishlists;
CREATE POLICY "Allow insert wishlists for owners" ON public.wishlists
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = user_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow delete wishlists for owners" ON public.wishlists;
CREATE POLICY "Allow delete wishlists for owners" ON public.wishlists
    FOR DELETE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = user_id) = (select auth.uid()));

-- 7. Optimize public.blocked_users policies
DROP POLICY IF EXISTS "Allow select blocked_users for blocker" ON public.blocked_users;
CREATE POLICY "Allow select blocked_users for blocker" ON public.blocked_users
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = blocker_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow insert blocked_users for blocker" ON public.blocked_users;
CREATE POLICY "Allow insert blocked_users for blocker" ON public.blocked_users
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = blocker_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow delete blocked_users for blocker" ON public.blocked_users;
CREATE POLICY "Allow delete blocked_users for blocker" ON public.blocked_users
    FOR DELETE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = blocker_id) = (select auth.uid()));

-- 8. Optimize public.reports policies
DROP POLICY IF EXISTS "Allow select reports for reporters" ON public.reports;
CREATE POLICY "Allow select reports for reporters" ON public.reports
    FOR SELECT TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = reporter_id) = (select auth.uid()));

DROP POLICY IF EXISTS "Allow insert reports for reporters" ON public.reports;
CREATE POLICY "Allow insert reports for reporters" ON public.reports
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = reporter_id) = (select auth.uid()));

-- 9. Optimize public.orders policies
DROP POLICY IF EXISTS "Allow select orders for participants" ON public.orders;
CREATE POLICY "Allow select orders for participants" ON public.orders
    FOR SELECT TO authenticated
    USING (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = (select auth.uid()) OR 
        (SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid())
    );

DROP POLICY IF EXISTS "Allow insert orders for buyers" ON public.orders;
CREATE POLICY "Allow insert orders for buyers" ON public.orders
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = (select auth.uid()) AND
        buyer_id <> seller_id
    );

DROP POLICY IF EXISTS "Allow update orders for participants" ON public.orders;
CREATE POLICY "Allow update orders for participants" ON public.orders
    FOR UPDATE TO authenticated
    USING (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = (select auth.uid()) OR 
        (SELECT auth_id FROM public.users WHERE id = seller_id) = (select auth.uid())
    );

-- 10. Optimize public.reviews policies
DROP POLICY IF EXISTS "Allow insert reviews for order participants" ON public.reviews;
CREATE POLICY "Allow insert reviews for order participants" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_id
              AND o.order_status = 'COMPLETED'
              AND (
                  (SELECT auth_id FROM public.users WHERE id = o.buyer_id) = (select auth.uid()) OR 
                  (SELECT auth_id FROM public.users WHERE id = o.seller_id) = (select auth.uid())
              )
        ) AND (
            (SELECT id FROM public.users WHERE auth_id = (select auth.uid())) = reviewer_id
        )
    );
