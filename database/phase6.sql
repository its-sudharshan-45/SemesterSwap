-- SemesterSwap Phase 6 Database Schema Migration
-- AI-Powered Intelligence Tables

-- 1. AI Price Predictions
CREATE TABLE IF NOT EXISTS public.ai_price_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    predicted_price FLOAT NOT NULL,
    minimum_price FLOAT NOT NULL,
    maximum_price FLOAT NOT NULL,
    confidence_score FLOAT NOT NULL,
    reasoning TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. AI Generated Content
CREATE TABLE IF NOT EXISTS public.ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    generated_title VARCHAR NOT NULL,
    generated_description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Fraud Analysis
CREATE TABLE IF NOT EXISTS public.fraud_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
    risk_score FLOAT NOT NULL,
    risk_level VARCHAR NOT NULL,
    analysis_reason TEXT NOT NULL,
    recommendations JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Image Quality Analysis
CREATE TABLE IF NOT EXISTS public.image_quality_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
    quality_score FLOAT NOT NULL,
    quality_level VARCHAR NOT NULL,
    feedback JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
