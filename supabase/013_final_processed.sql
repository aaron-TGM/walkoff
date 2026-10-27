-- Run in Supabase SQL Editor after 012_outreach.sql. Safe to run more than
-- once. Whether the engine has saved a final's moments yet, so a restart
-- between a game going final and its moments being saved still makes them.
-- Until this has run, the engine works as before.
-- RLS stays on with no policies: only the service role key can read or write.

ALTER TABLE games ADD COLUMN IF NOT EXISTS final_processed boolean;

ALTER TABLE games ENABLE ROW LEVEL SECURITY;
