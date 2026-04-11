-- Supabase migration: create the `videos` table for per-user video library
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE public.videos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id       TEXT NOT NULL,
  title        TEXT NOT NULL,
  authors      JSONB DEFAULT '[]',
  venue        TEXT,
  year         INT,
  url          TEXT,
  arxiv_id     TEXT,
  abstract     TEXT,
  sections     JSONB DEFAULT '[]',
  scenes       JSONB DEFAULT '[]',
  duration     REAL DEFAULT 0,
  blob_url     TEXT,
  is_sample    BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_videos_user_id ON public.videos(user_id);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own videos"
  ON public.videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own videos"
  ON public.videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own videos"
  ON public.videos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own videos"
  ON public.videos FOR DELETE
  USING (auth.uid() = user_id);
