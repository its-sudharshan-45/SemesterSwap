-- SemesterSwap Phase 4 Database Schema
-- Order Management, Transaction Flow & Mock Payment System

-- 1. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    order_status VARCHAR NOT NULL DEFAULT 'PENDING', -- PENDING, PAYMENT_COMPLETED, CANCELLED, COMPLETED
    payment_method VARCHAR NOT NULL, -- MOCK_PAYMENT, CASH, UPI
    payment_status VARCHAR NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
    transaction_id VARCHAR,
    seller_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Performance and Search Indexes
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);

-- 3. Enable RLS on Orders Table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "Allow select orders for participants" ON public.orders;
DROP POLICY IF EXISTS "Allow insert orders for buyers" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders for participants" ON public.orders;

-- 5. Create Orders RLS Policies
CREATE POLICY "Allow select orders for participants" ON public.orders
    FOR SELECT TO authenticated
    USING (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() OR 
        (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid()
    );

CREATE POLICY "Allow insert orders for buyers" ON public.orders
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() AND
        buyer_id <> seller_id -- Prevent self-purchases at RLS level
    );

CREATE POLICY "Allow update orders for participants" ON public.orders
    FOR UPDATE TO authenticated
    USING (
        (SELECT auth_id FROM public.users WHERE id = buyer_id) = auth.uid() OR 
        (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid()
    );

-- 6. Enable Supabase Realtime Replication on orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
