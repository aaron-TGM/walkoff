-- Run in Supabase SQL Editor after 010_player_moments.sql. Safe to run more
-- than once. Athletes who asked Walkoff to stop using them, as the privacy
-- policy promises: Walkoff deletes where they're from, never saves it again,
-- and makes no hometown moments or big signings about them. It keeps their
-- roster details, so it knows them when it sees them again. Until this has
-- run, exclude_athlete says so; everything else works as before.
-- RLS stays on with no policies: only the service role key can read or write.

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS opted_out_at   timestamptz;
-- Who asked and how: "Agent's email to hello@walkoff.io".
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS opted_out_note text;
CREATE INDEX IF NOT EXISTS athletes_opted_out_idx ON athletes (opted_out_at) WHERE opted_out_at IS NOT NULL;

ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
