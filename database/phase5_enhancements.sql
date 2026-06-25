-- SemesterSwap Phase 5.1 Enhancements Database Schema Migration
-- Database Integrity and Performance Optimization

-- 1. Strengthen reviews rating validation: rating must be between 1 and 5
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5);

-- 2. Performance index on messages for conversation_id and created_at
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at);

-- 3. Performance index on notifications for user_id, is_read, and created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, is_read, created_at);
