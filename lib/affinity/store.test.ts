import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fakeDb } from "../testing/fake-db";
import type { CatalogItem } from "./imports";
import { loadTaggedCatalog, saveCatalog } from "./store";

const BRAND = { id: "11111111-1111-4111-8111-111111111111", name: "Frost Buddy" };

// Frost Buddy: the team and design are in the title, with no Color option,
// so the product's own photo is the only one it has.
const tumbler: CatalogItem = {
  handle: "universal-buddy-georgia-bulldogs-legacy",
  title: "Universal Buddy | Georgia Bulldogs | Legacy",
  productType: "Universal Buddy",
  category: "",
  tags: ["NCAA"],
  description: "",
  price: 31.49,
  colorways: [],
  image: "https://cdn.shopify.com/uga.jpg",
};

describe("a product's own photo", () => {
  it("is saved and read back for picking", async () => {
    const db = fakeDb({ brands: [BRAND], brand_products: [], brand_uploads: [] });
    await saveCatalog(db, BRAND, "shopify_store", [tumbler]);
    const [saved] = await loadTaggedCatalog(db, BRAND.id);
    assert.equal(saved.image, "https://cdn.shopify.com/uga.jpg");
  });

  it("isn't needed before 015_product_image.sql has run", async () => {
    const db = fakeDb({ brands: [BRAND], brand_products: [], brand_uploads: [] }, { through: "014" });
    await saveCatalog(db, BRAND, "shopify_store", [tumbler]);
    const [saved] = await loadTaggedCatalog(db, BRAND.id);
    assert.equal(saved.title, tumbler.title);
    assert.equal(saved.image, "");
  });
});
