-- Run in Supabase SQL Editor after 004_affinity.sql. Safe to run more than once.
-- Colorways, so a team's win can feature the brand's products in that
-- team's colors without a logo.

-- The colors each product comes in: [{name, skus, image}], from the
-- variants' color option in the brand's product export.
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS colorways jsonb NOT NULL DEFAULT '[]'::jsonb;

-- What each of the brand's color names looks like ("azure heather" ->
-- {2e8bd8}). Rules name common colors on upload; Claude names the rest.
CREATE TABLE IF NOT EXISTS brand_colors (
  brand_id   uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  name       text NOT NULL,                 -- lowercased
  hex        text[] NOT NULL DEFAULT '{}',  -- one per color in the name
  tagged_by  text NOT NULL DEFAULT 'rules' CHECK (tagged_by IN ('rules', 'claude')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, name)
);

ALTER TABLE brand_colors ENABLE ROW LEVEL SECURITY;
