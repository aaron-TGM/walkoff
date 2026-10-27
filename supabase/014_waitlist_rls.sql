-- Run in Supabase SQL Editor after 013_final_processed.sql. Safe to run
-- more than once. Turns row level security on for the waitlist, like every
-- other table: 002_early_access.sql created it without, so a database built
-- from these files let anyone with the public anon key read and add early
-- access requests. Walkoff only uses the service role key, which RLS
-- doesn't apply to, so nothing else changes.

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Lists any table in the public schema that still has RLS off (there should
-- be none).
SELECT relname FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity;
