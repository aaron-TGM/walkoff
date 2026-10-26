-- Run in Supabase SQL Editor after 009_athletes.sql. Safe to run more than
-- once. Player moments in team sports: who decided a playoff game at the
-- very end (their towns get a hometown moment), and stars who change teams
-- (the new team's fans get a moment). Until this has run, Walkoff makes
-- neither; everything else works as before.
-- RLS stays on with no policies: only the service role key can read or write.

-- A playoff game-winner is a result of its own: the batter of a walk-off,
-- the scorer of an overtime goal, the shooter of a buzzer-beater.
ALTER TABLE athlete_results DROP CONSTRAINT IF EXISTS athlete_results_kind_check;
ALTER TABLE athlete_results ADD CONSTRAINT athlete_results_kind_check
  CHECK (kind IN ('title', 'win', 'lead', 'game_winner'));

-- Moves between teams. The roster sync keeps the team a player left when it
-- clears them, and notes when it first saw them on the team they're on now.
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS previous_team_id text REFERENCES teams (id) ON DELETE SET NULL;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS joined_at        timestamptz;
-- How well known a player is: the Wikimedia sites with a page about them
-- (Wikipedias in other languages, mostly), from Wikidata.
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS sitelinks        int CHECK (sitelinks >= 0);
CREATE INDEX IF NOT EXISTS athletes_joined_idx ON athletes (joined_at DESC) WHERE joined_at IS NOT NULL;

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_results ENABLE ROW LEVEL SECURITY;
