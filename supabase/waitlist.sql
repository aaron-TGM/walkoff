-- Run in Supabase SQL Editor (from walkoff-cursor-brief)
CREATE TABLE waitlist (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company     text NOT NULL,
  email       text NOT NULL,
  klaviyo_key text NOT NULL,
  league      text NOT NULL,
  team        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  contacted   boolean DEFAULT false
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow inserts" ON waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow reads for auth users" ON waitlist
  FOR SELECT USING (auth.role() = 'authenticated');
