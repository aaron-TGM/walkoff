-- Run in Supabase SQL Editor. Safe to run more than once, and on any
-- version of the waitlist table (or none).
-- Early access fields for the MCP / moments pivot.

CREATE TABLE IF NOT EXISTS waitlist (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company    text NOT NULL,
  email      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  contacted  boolean DEFAULT false
);

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS website  text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS role     text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS leagues  text[] DEFAULT '{}';
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS teams    text;
-- Columns from the first schema that the signup form still fills in.
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS league   text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS team     text;

-- The first schema required a Klaviyo key the form never sent, so every
-- insert failed. Keys are collected during onboarding, not on the form.
-- Only touch these columns where they exist.
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['klaviyo_key', 'league', 'team'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'waitlist' AND column_name = c
    ) THEN
      EXECUTE format('ALTER TABLE waitlist ALTER COLUMN %I DROP NOT NULL', c);
    END IF;
  END LOOP;
END $$;
