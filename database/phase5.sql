-- SemesterSwap Phase 5 Database Schema Migration
-- Real-Time Chat, Notifications, Reviews, Ratings, and User Trust System

-- 1. Add verification_status column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_status VARCHAR NOT NULL DEFAULT 'APPROVED';

-- 2. Drop existing RLS policies on conversations and messages to allow altering the table columns safely
DROP POLICY IF EXISTS "Allow select conversations for participants" ON public.conversations;
DROP POLICY IF EXISTS "Allow insert conversations for buyers" ON public.conversations;
DROP POLICY IF EXISTS "Allow update conversations for participants" ON public.conversations;
DROP POLICY IF EXISTS "Allow select messages for conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Allow insert messages for conversation participants" ON public.messages;
DROP POLICY IF EXISTS "Allow update read status for message recipients" ON public.messages;

-- 3. Alter conversations table: rename listing_id to product_id if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'conversations' 
          AND column_name = 'listing_id'
    ) THEN
        ALTER TABLE public.conversations RENAME COLUMN listing_id TO product_id;
    END IF;
END $$;

-- 4. Re-configure unique and check constraints on conversations table
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_listing_id_buyer_id_key;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_product_id_buyer_id_key;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_buyer_seller_product_unique;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_buyer_seller_product_unique UNIQUE (buyer_id, seller_id, product_id);

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS check_not_self_chat;
ALTER TABLE public.conversations ADD CONSTRAINT check_not_self_chat CHECK (buyer_id <> seller_id);

-- 5. Re-create Row Level Security Policies for conversations with the renamed product_id column
CREATE POLICY "Allow select conversations for participants" ON public.conversations
    FOR SELECT TO authenticated
    USING (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() OR 
        (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid()
    );

CREATE POLICY "Allow insert conversations for buyers" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() AND
        buyer_id <> seller_id
    );

CREATE POLICY "Allow update conversations for participants" ON public.conversations
    FOR UPDATE TO authenticated
    USING (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() OR 
        (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid()
    );

-- 6. Re-create Row Level Security Policies for messages
CREATE POLICY "Allow select messages for conversation participants" ON public.messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND ((SELECT auth_id FROM public.users WHERE id = c.buyer_id) = auth.uid() OR 
                   (SELECT auth_id FROM public.users WHERE id = c.seller_id) = auth.uid())
        )
    );

CREATE POLICY "Allow insert messages for conversation participants" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth_id FROM public.users WHERE id = sender_id) = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND ((SELECT auth_id FROM public.users WHERE id = c.buyer_id) = auth.uid() OR 
                   (SELECT auth_id FROM public.users WHERE id = c.seller_id) = auth.uid())
        )
    );

CREATE POLICY "Allow update read status for message recipients" ON public.messages
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
              AND ((SELECT auth_id FROM public.users WHERE id = c.buyer_id) = auth.uid() OR 
                   (SELECT auth_id FROM public.users WHERE id = c.seller_id) = auth.uid())
        )
    );

-- 7. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(order_id, reviewer_id),
    CONSTRAINT check_not_self_review CHECK (reviewer_id <> reviewee_id)
);

-- 8. Configure Row Level Security (RLS) for Reviews Table
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select reviews for everyone" ON public.reviews;
CREATE POLICY "Allow select reviews for everyone" ON public.reviews
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow insert reviews for order participants" ON public.reviews;
CREATE POLICY "Allow insert reviews for order participants" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_id
              AND o.order_status = 'COMPLETED'
              AND (
                  (SELECT auth_id FROM public.users WHERE id = o.buyer_id) = auth.uid() OR 
                  (SELECT auth_id FROM public.users WHERE id = o.seller_id) = auth.uid()
              )
        ) AND (
            (SELECT id FROM public.users WHERE auth_id = auth.uid()) = reviewer_id
        )
    );

-- 9. Redefine User Profile Immutability Trigger to exclude rating and total_transactions
CREATE OR REPLACE FUNCTION public.check_user_profile_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.admission_year IS DISTINCT FROM NEW.admission_year THEN
        RAISE EXCEPTION 'Cannot modify admission_year';
    END IF;
    IF OLD.department_id IS DISTINCT FROM NEW.department_id THEN
        RAISE EXCEPTION 'Cannot modify department_id';
    END IF;
    IF OLD.roll_number IS DISTINCT FROM NEW.roll_number THEN
        RAISE EXCEPTION 'Cannot modify roll_number';
    END IF;
    IF OLD.college_id IS DISTINCT FROM NEW.college_id THEN
        RAISE EXCEPTION 'Cannot modify college_id';
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
        RAISE EXCEPTION 'Cannot modify email';
    END IF;
    IF OLD.auth_id IS DISTINCT FROM NEW.auth_id THEN
        RAISE EXCEPTION 'Cannot modify auth_id';
    END IF;
    
    NEW.updated_at := TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create Database Trigger for automatically updating User Rating
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_reviewee_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_reviewee_id := OLD.reviewee_id;
    ELSE
        v_reviewee_id := NEW.reviewee_id;
    END IF;

    UPDATE public.users
    SET rating = COALESCE((
        SELECT AVG(rating)::FLOAT
        FROM public.reviews
        WHERE reviewee_id = v_reviewee_id
    ), 0.0)
    WHERE id = v_reviewee_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_user_rating ON public.reviews;
CREATE TRIGGER trigger_update_user_rating
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_rating();

-- 11. Create Database Trigger for automatically updating User Completed Transactions
CREATE OR REPLACE FUNCTION public.update_user_transactions()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.order_status = 'COMPLETED' AND (OLD.order_status IS DISTINCT FROM 'COMPLETED')) THEN
        -- Increment transactions for both buyer and seller
        UPDATE public.users
        SET total_transactions = total_transactions + 1
        WHERE id = NEW.buyer_id OR id = NEW.seller_id;
    ELSIF (OLD.order_status = 'COMPLETED' AND (NEW.order_status IS DISTINCT FROM 'COMPLETED')) THEN
        -- Decrement transactions if order completed was reverted
        UPDATE public.users
        SET total_transactions = GREATEST(0, total_transactions - 1)
        WHERE id = NEW.buyer_id OR id = NEW.seller_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_user_transactions ON public.orders;
CREATE TRIGGER trigger_update_user_transactions
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_transactions();

-- 12. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_product_id ON public.conversations(product_id);
