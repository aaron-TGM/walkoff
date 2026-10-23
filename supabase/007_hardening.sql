-- Run in Supabase SQL Editor after 006_mcp.sql. Safe to run more than once.
-- Walkoff reads and writes only with the service role key, which row level
-- security doesn't apply to, so no table needs a policy. The first waitlist
-- schema (from the original brief) added two: anyone with the public key
-- could add rows, and any signed-in Supabase Auth user could read every
-- early access request. Walkoff doesn't use Supabase Auth; drop them.
DROP POLICY IF EXISTS "Allow inserts" ON waitlist;
DROP POLICY IF EXISTS "Allow reads for auth users" ON waitlist;

-- Every table keeps RLS on. This lists any policy left in the public schema
-- (there should be none).
SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public';
