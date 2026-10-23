-- Run in Supabase SQL Editor after 006_mcp.sql. Safe to run more than once.

-- 1. Walkoff reads and writes only with the service role key, which row
-- level security doesn't apply to, so no table needs a policy. The first
-- waitlist schema (from the original brief) added two: anyone with the
-- public key could add rows, and any signed-in Supabase Auth user could read
-- every early access request. Walkoff doesn't use Supabase Auth; drop them.
DROP POLICY IF EXISTS "Allow inserts" ON waitlist;
DROP POLICY IF EXISTS "Allow reads for auth users" ON waitlist;

-- 2. Calls to the sign-in endpoints anyone can reach (app registration and
-- starting a sign-in), so they can be capped per caller. Keeps a keyed hash
-- of the caller's IP, never the IP, for a day.
CREATE TABLE IF NOT EXISTS oauth_events (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  ip   text NOT NULL,
  at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_events_kind_at_idx ON oauth_events (kind, at);
CREATE INDEX IF NOT EXISTS oauth_events_ip_idx ON oauth_events (ip, kind, at);
ALTER TABLE oauth_events ENABLE ROW LEVEL SECURITY;

-- 3. Clears out finished sign-ins, expired tokens, old call records, and
-- apps that registered but never signed anyone in. Walkoff runs it as sign-ins
-- start; Claude registers again if it ever needs to.
CREATE OR REPLACE FUNCTION walkoff_sweep_oauth() RETURNS void
LANGUAGE sql SET search_path = public AS $$
  DELETE FROM oauth_requests WHERE expires_at < now() - interval '1 hour';
  DELETE FROM oauth_grants WHERE expires_at < now() - interval '7 days';
  DELETE FROM oauth_events WHERE at < now() - interval '1 day';
  DELETE FROM oauth_clients c
  WHERE c.created_at < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM oauth_grants g WHERE g.client_id = c.client_id);
$$;
REVOKE ALL ON FUNCTION walkoff_sweep_oauth() FROM PUBLIC;
REVOKE ALL ON FUNCTION walkoff_sweep_oauth() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION walkoff_sweep_oauth() TO service_role;

-- Every table keeps RLS on. This lists any policy left in the public schema
-- (there should be none).
SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public';
