import assert from "node:assert/strict";
import { describe, it } from "node:test";

import Anthropic from "@anthropic-ai/sdk";
import { fakeClaude } from "../testing/fake-claude";
import { fakeDb } from "../testing/fake-db";
import { pendingWork, runCatalogPass } from "./catalog-tagging";
import type { CatalogItem } from "./imports";
import { saveCatalog, saveClaudeTags, saveColorNames } from "./store";

const brand = { id: "7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10", name: "Sample Athleisure" };

const item = (handle: string, title: string, colors: string[] = [], extra: Partial<CatalogItem> = {}): CatalogItem => ({
  handle,
  title,
  productType: "Hoodie",
  category: "",
  tags: [],
  description: "",
  price: 98,
  colorways: colors.map((name) => ({ name, skus: [], image: "" })),
  ...extra,
});

/** A catalog as uploaded: the hoodie already has Claude's tags and its
 *  color named. */
async function uploaded() {
  const db = fakeDb();
  await saveCatalog(db, brand, "shopify_products", [
    item("bolt-hoodie", "Bolt Hoodie", ["Navy"]),
    item("everyday-jogger", "Everyday Jogger", ["Dune"]),
    item("sunday-tee", "Sunday Tee", ["Navy", "Cove"]),
  ]);
  await saveClaudeTags(db, brand, [{ handle: "bolt-hoodie", title: "Bolt Hoodie", tags: { teams: [], colors: [], uses: [], seasons: [], interests: [] } }]);
  await saveColorNames(db, brand, [{ name: "Navy", hex: ["1f2a44"] }], "claude");
  return db;
}

const row = (db: Awaited<ReturnType<typeof uploaded>>, handle: string) => db.tables.brand_products.find((r) => r.handle === handle)!;

describe("Claude's catalog pass", () => {
  it("finds what Claude hasn't done, or everything with all", async () => {
    const db = await uploaded();
    const work = await pendingWork(db, brand);
    assert.equal(work.total, 3);
    assert.deepEqual(work.products.map((p) => p.handle), ["everyday-jogger", "sunday-tee"]);
    assert.deepEqual(work.colorNames, ["Dune", "Cove"]);
    const all = await pendingWork(db, brand, { all: true });
    assert.equal(all.products.length, 3);
    assert.deepEqual(all.colorNames, ["Navy", "Dune", "Cove"]);
  });

  it("saves Claude's tags and color names, then refreshes the map", async () => {
    const db = await uploaded();
    db.tables.brand_area_counts = [{ brand_id: brand.id, country: "US", area: "921", customers: 40, orders: 0, revenue: 0 }];
    const claude = fakeClaude();
    const pass = await runCatalogPass(await pendingWork(db, brand), { send: claude.send, saveTo: { db, brand } });
    assert.deepEqual(claude.calls.products, [["Everyday Jogger", "Sunday Tee"]]);
    assert.deepEqual(claude.calls.colors, [["Dune", "Cove"]]);
    assert.equal(pass.saved, 2);
    assert.equal(row(db, "sunday-tee").tagged_by, "claude");
    const colors = Object.fromEntries((db.tables.brand_colors ?? []).map((c) => [c.name, c.tagged_by]));
    assert.deepEqual(colors, { navy: "claude", dune: "claude", cove: "claude" });
    assert.ok(pass.report, "the map is made again with Claude's tags");
    assert.equal(db.tables.affinity_reports?.length, 1);
  });

  it("keeps the slices it finished when Claude stops it", async () => {
    const db = await uploaded();
    const stopped = new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers());
    const claude = fakeClaude({ fail: (call) => (call === 2 ? stopped : null) });
    await assert.rejects(
      runCatalogPass(await pendingWork(db, brand), { send: claude.send, saveTo: { db, brand }, sliceSize: 1 }),
      Anthropic.AuthenticationError,
    );
    assert.equal(row(db, "everyday-jogger").tagged_by, "claude", "the first slice was saved");
    assert.equal(row(db, "sunday-tee").tagged_by, "rules", "the second is still to do");
  });

  it("only looks when there's nowhere to save", async () => {
    const db = await uploaded();
    const pass = await runCatalogPass(await pendingWork(db, brand), { send: fakeClaude().send });
    assert.equal(pass.run?.tags.size, 2);
    assert.equal(pass.saved, 0);
    assert.equal(row(db, "sunday-tee").tagged_by, "rules");
    assert.equal(db.tables.affinity_reports, undefined);
  });
});

describe("saveCatalog", () => {
  it("keeps Claude's tags for unchanged products and tags changed ones again", async () => {
    const db = await uploaded();
    const team = [{ league: "nfl", teamId: "24", name: "Los Angeles Chargers", why: "Bolt" }];
    await saveClaudeTags(db, brand, [{ handle: "bolt-hoodie", title: "Bolt Hoodie", tags: { teams: team, colors: [], uses: [], seasons: [], interests: [] } }]);
    await saveCatalog(db, brand, "shopify_products", [
      item("bolt-hoodie", "Bolt Hoodie", ["Navy", "Gold"]),
      item("everyday-jogger", "Everyday Jogger", ["Dune"]),
    ]);
    assert.equal(row(db, "bolt-hoodie").tagged_by, "claude", "a new colorway isn't new text");
    assert.deepEqual(row(db, "bolt-hoodie").teams, team);

    await saveCatalog(db, brand, "shopify_products", [item("bolt-hoodie", "Bolt Hoodie", ["Navy"], { description: "Now in fleece." })]);
    assert.equal(row(db, "bolt-hoodie").tagged_by, "rules", "new text goes back to the rules for Claude's next pass");
  });
});
