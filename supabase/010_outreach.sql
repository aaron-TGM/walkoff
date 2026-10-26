-- Run in Supabase SQL Editor after 009_athletes.sql. Safe to run more than
-- once. Walkoff's own outreach to brands it would like as customers:
-- prospects (from a Store Leads export), the people to write to (from
-- Apollo, FullEnrich or Clay), each pitch and its private page
-- (www.walkoff.io/p/<token>), and the addresses never to write to again.
-- Operators only (scripts/prospects.ts). The pitch page reads one pitch by
-- its token. RLS is on with no policies: only the service role key can read
-- or write.

-- A store Walkoff might pitch. Location is usually the headquarters, which
-- picks its home teams; the score says how well its catalog wears them.
CREATE TABLE IF NOT EXISTS prospects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text NOT NULL UNIQUE,          -- "frostbuddy.com": lowercase, no www
  name          text,                          -- the merchant's name
  store_url     text,                          -- https origin the catalog is read from
  platform      text,                          -- "shopify"
  country       text,                          -- ISO code: "US"
  city          text,
  region        text,                          -- state or province: "CA"
  postal_code   text,
  lat           double precision,
  lng           double precision,
  monthly_sales numeric(14, 2),                -- Store Leads' estimate, USD
  product_count int,
  categories    text[] NOT NULL DEFAULT '{}',
  apps          text[] NOT NULL DEFAULT '{}',  -- installed apps and technologies: "Klaviyo"
  source        text NOT NULL DEFAULT 'storeleads',
  home_area     text,                          -- postal area at the headquarters: "US:921"
  home_teams    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{key, name, share}], one per league
  status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'qualified', 'skipped', 'contacted', 'replied', 'trial', 'customer', 'lost')),
  score         real CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  best_team     text,                          -- "nfl:24": the home team its catalog wears best
  score_detail  jsonb,                         -- each home team's picks and score, or why it was skipped
  scored_at     timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects (status, score DESC);

-- Someone at a prospect to write to: a founder or whoever owns email.
CREATE TABLE IF NOT EXISTS prospect_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid NOT NULL REFERENCES prospects (id) ON DELETE CASCADE,
  email        text NOT NULL,                  -- lowercase
  name         text,
  first_name   text,
  title        text,
  linkedin     text,
  email_status text,                           -- as the lookup tool reports it: "verified"
  source       text NOT NULL DEFAULT 'csv',    -- apollo, fullenrich, clay, csv
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, email)
);

-- Each pitch: the private page a prospect gets, the sample campaign it
-- shows (saved when the pitch is made, so the page never changes), the
-- email that carried it and what came of it.
CREATE TABLE IF NOT EXISTS outreach (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects (id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES prospect_contacts (id) ON DELETE SET NULL,
  token           text NOT NULL UNIQUE,          -- secret in the page link
  team_key        text NOT NULL,                 -- "nfl:24"
  moment_id       uuid REFERENCES moments (id) ON DELETE SET NULL,   -- null: a sample
  moment_type     text NOT NULL,
  campaign        jsonb NOT NULL,                -- what the page shows
  subject         text NOT NULL,                 -- the email to the prospect
  body            text NOT NULL,
  status          text NOT NULL DEFAULT 'drafted'
                  CHECK (status IN ('drafted', 'sent', 'replied', 'bounced', 'unsubscribed')),
  sent_at         timestamptz,
  replied_at      timestamptz,
  views           int NOT NULL DEFAULT 0,        -- page opens in a browser, not counting previews
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_prospect_idx ON outreach (prospect_id, created_at DESC);

-- Never write to these again: an email address or a whole domain,
-- lowercase. Checked before every pitch.
CREATE TABLE IF NOT EXISTS do_not_contact (
  value      text PRIMARY KEY,                -- "sam@frostbuddy.com" or "frostbuddy.com"
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE do_not_contact ENABLE ROW LEVEL SECURITY;
