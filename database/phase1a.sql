-- SemesterSwap Phase 1A Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Colleges Table
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    email_domain VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE NOT NULL,
    college_id UUID REFERENCES public.colleges(id),
    department_id UUID REFERENCES public.departments(id),
    full_name VARCHAR,
    email VARCHAR UNIQUE NOT NULL,
    admission_year INTEGER,
    roll_number INTEGER,
    profile_image TEXT,
    rating FLOAT DEFAULT 0 NOT NULL,
    total_transactions INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Seed Seed Data
INSERT INTO public.colleges (name, email_domain) VALUES
('KPRIET', 'kpriet.ac.in')
ON CONFLICT (email_domain) DO NOTHING;

INSERT INTO public.departments (code, name) VALUES
('ad', 'Artificial Intelligence & Data Science'),
('cs', 'Computer Science Engineering'),
('ec', 'Electronics & Communication Engineering'),
('me', 'Mechanical Engineering')
ON CONFLICT (code) DO NOTHING;

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow select colleges for authenticated users" ON public.colleges;
DROP POLICY IF EXISTS "Allow select departments for authenticated users" ON public.departments;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create RLS Policies
CREATE POLICY "Allow select colleges for authenticated users" ON public.colleges
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow select departments for authenticated users" ON public.departments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT TO authenticated USING (auth.uid() = auth_id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);

-- 6. Trigger to Enforce Immutability of Specific Fields in Users Table
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
    IF OLD.rating IS DISTINCT FROM NEW.rating THEN
        RAISE EXCEPTION 'Cannot modify rating';
    END IF;
    IF OLD.total_transactions IS DISTINCT FROM NEW.total_transactions THEN
        RAISE EXCEPTION 'Cannot modify total_transactions';
    END IF;
    
    NEW.updated_at := TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_user_profile_immutability ON public.users;
CREATE TRIGGER enforce_user_profile_immutability
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.check_user_profile_immutability();

-- 7. Trigger Function for Automatic User Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_email_domain VARCHAR;
    v_college_id UUID;
    v_department_id UUID;
    v_department_code VARCHAR;
    v_admission_year INTEGER;
    v_roll_number INTEGER;
    v_email_local VARCHAR;
    v_full_name VARCHAR;
    v_profile_image TEXT;
BEGIN
    -- Extract email domain (everything after @)
    v_email_domain := split_part(NEW.email, '@', 2);
    
    -- Check if domain exists in verified colleges
    SELECT id INTO v_college_id FROM public.colleges WHERE email_domain = v_email_domain;
    
    -- If college domain is not verified, do not create profile
    IF v_college_id IS NULL THEN
        RAISE EXCEPTION 'Only verified college students can access SemesterSwap.';
    END IF;
    
    -- Extract student details from email local part (everything before @)
    v_email_local := split_part(NEW.email, '@', 1);
    
    -- Parse local part YYDDRRR (e.g., 24ad119)
    -- YY (2 digits) -> admission year
    -- DD (2 characters) -> department code
    -- RRR (remaining digits) -> roll number
    IF v_email_local ~ '^[0-9]{2}[a-zA-Z]{2}[0-9]+$' THEN
        v_admission_year := 2000 + (substring(v_email_local from 1 for 2))::INTEGER;
        v_department_code := lower(substring(v_email_local from 3 for 2));
        v_roll_number := (substring(v_email_local from 5))::INTEGER;
        
        -- Look up department ID
        SELECT id INTO v_department_id FROM public.departments WHERE code = v_department_code;
    ELSE
        -- Fallback for non-standard formats (safely handle invalid formats)
        v_admission_year := NULL;
        v_department_id := NULL;
        v_roll_number := NULL;
    END IF;
    
    -- Extract name and avatar url from raw metadata
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    v_profile_image := NEW.raw_user_meta_data->>'avatar_url';
    
    -- Insert new profile record
    INSERT INTO public.users (
        id,
        auth_id,
        college_id,
        department_id,
        full_name,
        email,
        admission_year,
        roll_number,
        profile_image,
        rating,
        total_transactions,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        NEW.id,
        v_college_id,
        v_department_id,
        v_full_name,
        NEW.email,
        v_admission_year,
        v_roll_number,
        v_profile_image,
        0.0,
        0,
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to hook into auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Note: In Supabase, the trigger should be created in the auth schema, but table users is in public.
-- In a standard Supabase deployment, the trigger command is:
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
