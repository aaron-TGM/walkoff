-- Run in Supabase SQL Editor after 002_early_access.sql.
-- Tables written by the moment engine (engine/). Safe to run more than once.
-- RLS is on with no policies: only the service role key can read or write.

CREATE TABLE IF NOT EXISTS teams (
  id              text PRIMARY KEY,          -- "espn:nfl:21"
  league          text NOT NULL,             -- lib/leagues.ts id, e.g. "nfl"
  external_id     text NOT NULL,             -- feed team id, e.g. "21"
  abbreviation    text,
  display_name    text NOT NULL,             -- "Philadelphia Eagles"
  short_name      text,                      -- "Eagles"
  location        text,                      -- "Philadelphia"
  color           text,
  alternate_color text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id               text PRIMARY KEY,         -- "espn:nfl:401872923"
  league           text NOT NULL,
  external_id      text NOT NULL,
  name             text NOT NULL,            -- "New Orleans Saints at Detroit Lions"
  starts_at        timestamptz NOT NULL,
  state            text NOT NULL CHECK (state IN ('pre', 'in', 'post')),
  completed        boolean NOT NULL DEFAULT false,
  status_detail    text,                     -- "Final/OT", "Bot 9th", "78'"
  period           int,
  season_type      int,                      -- 1 preseason, 2 regular, 3 postseason
  headline         text,                     -- "World Series - Game 1"
  home_team_id     text NOT NULL REFERENCES teams (id),
  away_team_id     text NOT NULL REFERENCES teams (id),
  home_score       int NOT NULL DEFAULT 0,
  away_score       int NOT NULL DEFAULT 0,
  -- Largest deficit each side faced at any point, for comeback moments.
  max_home_deficit int NOT NULL DEFAULT 0,
  max_away_deficit int NOT NULL DEFAULT 0,
  final_at         timestamptz,              -- when the engine saw it go final
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_league_starts_idx ON games (league, starts_at);
CREATE INDEX IF NOT EXISTS games_updated_idx ON games (updated_at DESC);

CREATE TABLE IF NOT EXISTS moments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key       text NOT NULL UNIQUE,     -- "walkoff_win:espn:mlb:401908003:espn:mlb:8"
  type             text NOT NULL,            -- trigger id from lib/triggers.ts
  category         text NOT NULL DEFAULT 'sports',
  phase            text NOT NULL CHECK (phase IN ('before', 'during', 'after', 'season')),
  league           text NOT NULL,
  game_id          text REFERENCES games (id),
  team_id          text REFERENCES teams (id),         -- whose fans the moment is for
  opponent_team_id text REFERENCES teams (id),
  headline         text NOT NULL,
  intensity        real NOT NULL CHECK (intensity >= 0 AND intensity <= 1),
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at      timestamptz NOT NULL,
  detected_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moments_detected_idx ON moments (detected_at DESC);
CREATE INDEX IF NOT EXISTS moments_team_idx ON moments (team_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS moments_type_idx ON moments (type, detected_at DESC);

-- One row per league, updated by every poll. Read by walkoff.io/status.
CREATE TABLE IF NOT EXISTS engine_heartbeats (
  league               text PRIMARY KEY,
  last_poll_at         timestamptz,
  last_ok_at           timestamptz,
  last_error_at        timestamptz,
  last_error           text,
  latency_ms           int,
  games                int NOT NULL DEFAULT 0,
  live_games           int NOT NULL DEFAULT 0,
  consecutive_failures int NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_heartbeats ENABLE ROW LEVEL SECURITY;
