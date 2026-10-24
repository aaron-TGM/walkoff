-- Run in Supabase SQL Editor. Safe to run more than once.
-- Where each early access request came from, as the signup form sends it:
-- the campaign tags on the link the visit started from, the site that sent
-- it (the host only), the page it landed on and the early access button
-- clicked. Until this has run, requests save without them, and the signup
-- email says so.

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_source    text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_medium    text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_campaign  text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_content   text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS utm_term      text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referrer      text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS landing_path  text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS cta_placement text;
