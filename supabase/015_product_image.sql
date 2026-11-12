-- Each product's first photo, for stores whose products have no Color option
-- (the design is in the title: "Universal Buddy | Georgia Bulldogs | Legacy").
-- Without it their campaigns show no product photos. Run this before
-- deploying the code that reads it, then run import_catalog again for those
-- brands: Claude's tags are kept, since the products' text hasn't changed.
ALTER TABLE brand_products ADD COLUMN IF NOT EXISTS image text;
