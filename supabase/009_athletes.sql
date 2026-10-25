-- Run in Supabase SQL Editor after 008_waitlist_attribution.sql. Safe to run
-- more than once. Athletes and where they're from, for hometown moments:
-- when someone from a town does something big, brands with customers there
-- can celebrate the town. Until this has run, Walkoff has no athletes and
-- makes no hometown moments; everything else works as before.
-- RLS is on with no policies: only the service role key can read or write.

-- Players on the rosters Walkoff follows, and those who play alone (golf,
-- tennis, racing). Public facts only: no birth dates, ages or photos.
CREATE TABLE IF NOT EXISTS athletes (
  id                  text PRIMARY KEY,           -- "espn:football:3912547": ESPN keeps one id across a sport
  sport               text NOT NULL,              -- "football", "golf"
  league              text,                       -- lib/leagues.ts id or tour: "nfl", "pga"
  external_id         text NOT NULL,              -- the feed's id: "3912547"
  display_name        text NOT NULL,              -- for operators and marketers, never campaign copy
  name_key            text NOT NULL,              -- lowercase, no accents or spaces, for search
  team_id             text REFERENCES teams (id) ON DELETE SET NULL,
  position            text,                       -- "QB"
  jersey              text,
  roster_status       text CHECK (roster_status IN ('active', 'reserve')),
  college             text,
  wikidata_id         text,                       -- Wikidata item id, like "Q42"
  roster_checked_at   timestamptz,                -- last seen on a roster
  bio_checked_at      timestamptz,                -- last read the bio (golf, tennis, racing)
  wikidata_checked_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS athletes_team_idx ON athletes (team_id);
CREATE INDEX IF NOT EXISTS athletes_name_idx ON athletes (name_key);

-- Where each athlete is from: one row per kind and source. lib/athletes
-- ranks them: an operator's word, then the curated file, then a high
-- school, then a birthplace.
CREATE TABLE IF NOT EXISTS athlete_places (
  athlete_id text NOT NULL REFERENCES athletes (id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('birthplace', 'high_school', 'hometown')),
  source     text NOT NULL CHECK (source IN ('espn', 'wikidata', 'curated', 'operator')),
  raw        text NOT NULL,                       -- as the source has it: "Capistrano Beach, CA"
  resolution text NOT NULL CHECK (resolution IN ('found', 'ambiguous', 'unknown', 'outside')),
  place_key  text,                                -- lib/places key when found: "zip:92624"
  place_name text,                                -- "Capistrano Beach"
  region     text,                                -- "CA"
  country    text CHECK (country IN ('US', 'CA', 'GB')),
  lat        double precision,
  lng        double precision,
  ref_code   text,                                -- where Klaviyo centers the town's circle: "92624"
  area       text,                                -- that code's postal area: "926"
  confidence real NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  active     boolean NOT NULL DEFAULT true,       -- false: an operator ruled it out
  note       text,
  updated_by text NOT NULL DEFAULT 'engine',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, kind, source)
);
CREATE INDEX IF NOT EXISTS athlete_places_place_idx ON athlete_places (place_key);

-- Roster sync progress per team, so a restart picks up where it stopped.
CREATE TABLE IF NOT EXISTS roster_syncs (
  team_id    text PRIMARY KEY REFERENCES teams (id) ON DELETE CASCADE,
  league     text NOT NULL,
  synced_at  timestamptz,                         -- the last full sync
  athletes   int NOT NULL DEFAULT 0,
  failures   int NOT NULL DEFAULT 0,              -- in a row
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Who won what, from the roster at the time: a champion's players, a
-- tournament's winner, an overnight leader. role is leader (led the team
-- in the title game, or won alone), played, roster or reserve.
CREATE TABLE IF NOT EXISTS athlete_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  text NOT NULL REFERENCES athletes (id) ON DELETE CASCADE,
  event_key   text NOT NULL,                      -- "espn:nfl:401772988"
  event_name  text NOT NULL,                      -- "Super Bowl LX", for the marketer's eyes only
  kind        text NOT NULL CHECK (kind IN ('title', 'win', 'lead')),
  role        text NOT NULL CHECK (role IN ('leader', 'played', 'roster', 'reserve')),
  team_id     text REFERENCES teams (id) ON DELETE SET NULL,
  moment_id   uuid REFERENCES moments (id) ON DELETE CASCADE,  -- the team moment it came from
  intensity   real NOT NULL CHECK (intensity >= 0 AND intensity <= 1),
  occurred_at timestamptz NOT NULL,
  created_by  text NOT NULL DEFAULT 'engine',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, athlete_id, kind)
);
CREATE INDEX IF NOT EXISTS athlete_results_moment_idx ON athlete_results (moment_id);
CREATE INDEX IF NOT EXISTS athlete_results_occurred_idx ON athlete_results (occurred_at DESC);

-- Athletes who agreed in writing that a brand may name them (an NIL or
-- sponsor deal). Without a row in date, copy celebrates the town and never
-- names or describes the athlete.
CREATE TABLE IF NOT EXISTS brand_athlete_rights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  athlete_id  text NOT NULL REFERENCES athletes (id) ON DELETE CASCADE,
  may_name    boolean NOT NULL DEFAULT false,
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  evidence    text NOT NULL CHECK (char_length(evidence) > 0),  -- where the agreement is: a contract id or link
  recorded_by text NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS brand_athlete_rights_brand_idx ON brand_athlete_rights (brand_id, athlete_id);

-- Hometown moments name the town and the athlete it's about. An operator
-- can retract a wrong one, which hides it from every queue.
ALTER TABLE moments ADD COLUMN IF NOT EXISTS athlete_id       text REFERENCES athletes (id) ON DELETE SET NULL;
ALTER TABLE moments ADD COLUMN IF NOT EXISTS place_key        text;
ALTER TABLE moments ADD COLUMN IF NOT EXISTS retracted_at     timestamptz;
ALTER TABLE moments ADD COLUMN IF NOT EXISTS retracted_reason text;
CREATE INDEX IF NOT EXISTS moments_place_idx ON moments (detected_at DESC)
  WHERE place_key IS NOT NULL AND retracted_at IS NULL;

-- Rules for towns: which towns (lib/places keys; empty: any town near the
-- brand's customers), and how many customers a town needs.
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS place_keys          text[] NOT NULL DEFAULT '{}';
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS min_local_customers int CHECK (min_local_customers >= 0);

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_athlete_rights ENABLE ROW LEVEL SECURITY;
