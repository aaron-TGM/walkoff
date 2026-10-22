-- Run in Supabase SQL Editor after waitlist.sql.
-- Early access fields for the MCP / moments pivot. Safe to run more than once.

-- The first schema required a Klaviyo key the form never sent, so every
-- insert failed. Keys are collected during onboarding, not on the form.
ALTER TABLE waitlist ALTER COLUMN klaviyo_key DROP NOT NULL;
ALTER TABLE waitlist ALTER COLUMN league DROP NOT NULL;
ALTER TABLE waitlist ALTER COLUMN team DROP NOT NULL;

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS website  text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS role     text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS leagues  text[] DEFAULT '{}';
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS teams    text;
