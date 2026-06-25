-- SemesterSwap Phase 1B Database Schema

-- 1. Create Listings Table
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR NOT NULL,
    condition VARCHAR NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR DEFAULT 'available' NOT NULL,
    images JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable RLS on Listings
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select listings for everyone" ON public.listings;
DROP POLICY IF EXISTS "Allow insert listings for authenticated users" ON public.listings;
DROP POLICY IF EXISTS "Allow update listings for owners" ON public.listings;
DROP POLICY IF EXISTS "Allow delete listings for owners" ON public.listings;

-- Create Listings RLS Policies
-- Public Access: View available listings or owned listings
CREATE POLICY "Allow select listings for everyone" ON public.listings
    FOR SELECT TO public
    USING (status = 'available' OR (auth.role() = 'authenticated' AND (SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid()));

-- Authenticated Users: Create listings
CREATE POLICY "Allow insert listings for authenticated users" ON public.listings
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid());

-- Ownership Rules: Edit or mark as sold (UPDATE)
CREATE POLICY "Allow update listings for owners" ON public.listings
    FOR UPDATE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid())
    WITH CHECK ((SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid());

-- Ownership Rules: Delete listings
CREATE POLICY "Allow delete listings for owners" ON public.listings
    FOR DELETE TO authenticated
    USING ((SELECT auth_id FROM public.users WHERE id = seller_id) = auth.uid());


-- 3. Create listing-images Storage Bucket (Direct INSERT)
-- RLS on storage.objects is already enabled by default in Supabase.
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Public Read Access for listing-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated User Upload for listing-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated User Update for listing-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated User Delete for listing-images" ON storage.objects;

-- Create Storage RLS Policies
-- Public Read Access: Anyone can fetch image URLs
CREATE POLICY "Public Read Access for listing-images" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'listing-images');

-- Authenticated User Upload: Can upload only to user-id/ folder matching their authenticated ID
CREATE POLICY "Authenticated User Upload for listing-images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'listing-images' AND split_part(name, '/', 1) = auth.uid()::text);

-- Authenticated User Update: Can overwrite their own files
CREATE POLICY "Authenticated User Update for listing-images" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'listing-images' AND split_part(name, '/', 1) = auth.uid()::text)
    WITH CHECK (bucket_id = 'listing-images' AND split_part(name, '/', 1) = auth.uid()::text);

-- Authenticated User Delete: Can delete their own files
CREATE POLICY "Authenticated User Delete for listing-images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'listing-images' AND split_part(name, '/', 1) = auth.uid()::text);
