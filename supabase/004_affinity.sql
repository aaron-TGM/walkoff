-- Run in Supabase SQL Editor after 003_moment_engine.sql.
-- Brands, the counts they upload, their products and affinity reports.
-- Safe to run more than once. RLS is on with no policies: only the service
-- role key (the site's API routes and scripts) can read or write.

CREATE TABLE IF NOT EXISTS brands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  -- Secret in the brand's upload link: walkoff.io/upload/<token>
  upload_token  text NOT NULL UNIQUE,
  contact_email text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per file a brand uploads (what it was, how big), never its rows.
CREATE TABLE IF NOT EXISTS brand_uploads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  format     text NOT NULL,           -- shopify_customers, shopify_orders, klaviyo_profiles, ...
  rows_read  int NOT NULL,            -- rows in the brand's file
  rows_saved int NOT NULL,            -- aggregated rows stored
  customers  int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_uploads_brand_idx ON brand_uploads (brand_id, created_at DESC);

-- Customers per postal area. Areas are never finer than a US 3-digit ZIP,
-- a Canadian FSA or a UK postcode district.
CREATE TABLE IF NOT EXISTS brand_area_counts (
  brand_id  uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  country   text NOT NULL CHECK (country IN ('US', 'CA', 'GB')),
  area      text NOT NULL CHECK (char_length(area) <= 4),
  customers int NOT NULL DEFAULT 0 CHECK (customers >= 0),
  orders    int NOT NULL DEFAULT 0 CHECK (orders >= 0),
  revenue   numeric(14, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (brand_id, country, area)
);

-- Orders of each product per postal area, from an order export.
CREATE TABLE IF NOT EXISTS brand_product_counts (
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  country  text NOT NULL CHECK (country IN ('US', 'CA', 'GB')),
  area     text NOT NULL CHECK (char_length(area) <= 4),
  product  text NOT NULL,
  orders   int NOT NULL DEFAULT 0 CHECK (orders >= 0),
  revenue  numeric(14, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (brand_id, country, area, product)
);

-- The brand's catalog and the tags Walkoff adds to it.
CREATE TABLE IF NOT EXISTS brand_products (
  brand_id     uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  handle       text NOT NULL,
  title        text NOT NULL,
  product_type text,
  category     text,
  tags         text[] NOT NULL DEFAULT '{}',
  description  text,
  price        numeric(12, 2),
  teams        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{league, teamId, name, why}]
  colors       text[] NOT NULL DEFAULT '{}',
  uses         text[] NOT NULL DEFAULT '{}',         -- cold_weather, tailgate, gift, ...
  seasons      text[] NOT NULL DEFAULT '{}',
  interests    text[] NOT NULL DEFAULT '{}',         -- surf, fishing, western, ...
  tagged_by    text NOT NULL DEFAULT 'rules' CHECK (tagged_by IN ('rules', 'claude')),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, handle)
);

CREATE TABLE IF NOT EXISTS affinity_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid NOT NULL REFERENCES brands (id) ON DELETE CASCADE,
  report     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affinity_reports_brand_idx ON affinity_reports (brand_id, created_at DESC);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_area_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_product_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affinity_reports ENABLE ROW LEVEL SECURITY;
