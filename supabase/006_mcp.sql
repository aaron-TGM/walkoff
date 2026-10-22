-- Run in Supabase SQL Editor after 005_colorways.sql. Safe to run more than once.
-- The Walkoff MCP server (www.walkoff.io/mcp): who can connect it in Claude,
-- the OAuth records Claude's connector uses, triggers and the send log.
-- RLS is on with no policies: only the service role key can read or write.

-- For product links in campaigns, and whether messages may name teams.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS store_url text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS licensed boolean NOT NULL DEFAULT false;

-- People who can connect Walkoff for a brand. Operators listed in
-- WALKOFF_OPERATOR_EMAILS reach every brand without a row here.
CREATE TABLE IF NOT EXISTS brand_members (
  brand_id   uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  email      text NOT NULL CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, email)
);
CREATE INDEX IF NOT EXISTS brand_members_email_idx ON brand_members (email);

-- OAuth clients: Claude registers itself (dynamic client registration) or
-- names a client metadata document by URL, which is cached here.
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('dcr', 'cimd')),
  client_name   text,
  redirect_uris text[] NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  fetched_at    timestamptz NOT NULL DEFAULT now()
);

-- A sign-in in progress: the authorization request, then the emailed code.
CREATE TABLE IF NOT EXISTS oauth_requests (
  id              text PRIMARY KEY,          -- random, carried in the sign-in form
  client_id       text NOT NULL,
  redirect_uri    text NOT NULL,
  state           text,
  code_challenge  text NOT NULL,
  scope           text,
  resource        text NOT NULL,
  email           text,
  email_code_hash text,
  codes_sent      int NOT NULL DEFAULT 0,
  attempts        int NOT NULL DEFAULT 0,
  verified_at     timestamptz,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Authorization codes and tokens, stored only as SHA-256 hashes.
CREATE TABLE IF NOT EXISTS oauth_grants (
  token_hash     text PRIMARY KEY,
  kind           text NOT NULL CHECK (kind IN ('code', 'access', 'refresh')),
  client_id      text NOT NULL,
  email          text NOT NULL,
  brand_ids      uuid[],                     -- null: every brand (operators)
  scope          text,
  resource       text NOT NULL,
  redirect_uri   text,                       -- codes only
  code_challenge text,                       -- codes only
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,                -- spent codes and rotated refresh tokens
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_grants_email_idx ON oauth_grants (email);

-- Rules: which moments a brand wants to act on.
CREATE TABLE IF NOT EXISTS triggers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  name          text NOT NULL,
  moment_types  text[] NOT NULL DEFAULT '{}',  -- empty: any moment
  team_keys     text[] NOT NULL DEFAULT '{}',  -- "nfl:24"; empty: the brand's standout territories
  min_intensity real NOT NULL DEFAULT 0 CHECK (min_intensity >= 0 AND min_intensity <= 1),
  active        boolean NOT NULL DEFAULT true,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS triggers_brand_idx ON triggers (brand_id);

-- What a brand did with a moment: drafted, sent or skipped.
CREATE TABLE IF NOT EXISTS sends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  moment_id     uuid NOT NULL REFERENCES moments (id) ON DELETE CASCADE,
  trigger_id    uuid REFERENCES triggers (id) ON DELETE SET NULL,
  status        text NOT NULL CHECK (status IN ('drafted', 'sent', 'skipped')),
  channel       text NOT NULL DEFAULT 'email',
  campaign_ref  text,                          -- Klaviyo campaign id or link
  audience_size int,
  notes         text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sends_brand_idx ON sends (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sends_moment_idx ON sends (moment_id);

ALTER TABLE brand_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sends ENABLE ROW LEVEL SECURITY;
