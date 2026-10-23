import assert from "node:assert/strict";
import { describe, it } from "node:test";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODEL } from "../lib/affinity/claude-tagger";
import { fakeClaude } from "../lib/testing/fake-claude";
import { fakeDb, type Row } from "../lib/testing/fake-db";
import { loadConfig } from "./config";
import { CatalogTagger, TAGGER_DELAYS } from "./tagger";

const SUN = "11111111-1111-4111-8111-111111111111";
const FROST = "22222222-2222-4222-8222-222222222222";
const START = Date.parse("2026-10-23T12:00:00Z");
const at = (ms: number) => new Date(ms).toISOString();

/** A product row as an upload leaves it: keyword tags only. */
const product = (brandId: string, handle: string, title: string, updatedAt: number): Row => ({
  brand_id: brandId,
  handle,
  title,
  product_type: null,
  category: null,
  tags: [],
  description: null,
  colorways: [],
  teams: [],
  tagged_by: "rules",
  updated_at: at(updatedAt),
});

function setup(products: Row[]) {
  const db = fakeDb({
    brands: [
      { id: SUN, name: "Sun Supply" },
      { id: FROST, name: "Frost Buddy" },
    ],
    brand_products: products,
  });
  let now = START;
  const claude = fakeClaude();
  const tagger = new CatalogTagger(db, { send: claude.send, model: DEFAULT_MODEL, now: () => now });
  return { db, claude, tagger, wait: (ms: number) => (now += ms), now: () => now };
}

const taggedBy = (db: { tables: Record<string, Row[]> }, handle: string) => db.tables.brand_products.find((r) => r.handle === handle)?.tagged_by;

describe("CatalogTagger", () => {
  it("tags the newest upload first, then the next brand, then waits", async () => {
    const { db, claude, tagger } = setup([
      product(SUN, "sun-hat", "Bolt Sun Hat", START - 60_000),
      product(FROST, "mitt", "Frost Mitt", START - 30_000),
    ]);
    assert.equal(await tagger.tick(), TAGGER_DELAYS.next);
    assert.deepEqual(claude.calls.products, [["Frost Mitt"]], "Frost Buddy uploaded last");
    assert.equal(await tagger.tick(), TAGGER_DELAYS.next);
    assert.deepEqual(claude.calls.products.at(-1), ["Bolt Sun Hat"]);
    assert.equal(taggedBy(db, "sun-hat"), "claude");
    assert.deepEqual(db.tables.brand_products.find((r) => r.handle === "sun-hat")?.teams, [
      { league: "nfl", teamId: "24", name: "Los Angeles Chargers", why: `"Bolt" in the title` },
    ]);
    assert.equal(await tagger.tick(), TAGGER_DELAYS.idle);
    assert.equal(claude.calls.products.length, 2);
  });

  it("comes back for a new upload, and retries what Claude left out an hour later", async () => {
    const { db, claude, tagger, wait, now } = setup([product(SUN, "riddle", "Mystery Tee", START - 60_000)]);
    await tagger.tick();
    assert.equal(taggedBy(db, "riddle"), "rules", "Claude left it out");
    const tries = claude.calls.products.length;
    assert.equal(await tagger.tick(), TAGGER_DELAYS.idle, "not again straight away");

    wait(5 * 60_000);
    db.tables.brand_products.push(product(SUN, "visor", "Bolt Visor", now()));
    assert.equal(await tagger.tick(), TAGGER_DELAYS.next);
    assert.equal(taggedBy(db, "visor"), "claude", "the new upload gets its pass");
    assert.equal(await tagger.tick(), TAGGER_DELAYS.idle);

    wait(TAGGER_DELAYS.retry);
    const before = claude.calls.products.length;
    await tagger.tick();
    assert.ok(claude.calls.products.length > before && before > tries, "an hour on, it tries the leftover again");
  });

  it("names a new color on a product Claude already tagged", async () => {
    const { db, claude, tagger } = setup([
      { ...product(SUN, "sun-hat", "Sun Hat", START - 60_000), tagged_by: "claude", colorways: [{ name: "Dune", skus: [], image: "" }] },
    ]);
    db.tables.brand_colors = [{ brand_id: SUN, name: "dune", hex: [], tagged_by: "rules", updated_at: at(START - 60_000) }];
    assert.equal(await tagger.tick(), TAGGER_DELAYS.next);
    assert.deepEqual([claude.calls.products, claude.calls.colors], [[], [["Dune"]]]);
    assert.equal(db.tables.brand_colors[0].tagged_by, "claude");
  });

  it("pauses when Claude rejects the key, and keeps going after other errors", async () => {
    const rejected = setup([product(SUN, "sun-hat", "Sun Hat", START)]);
    const key = new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers());
    const claude = fakeClaude({ fail: () => key });
    const tagger = new CatalogTagger(rejected.db, { send: claude.send, model: DEFAULT_MODEL, now: rejected.now });
    assert.equal(await tagger.tick(), TAGGER_DELAYS.rejected);

    const offline = {
      from: () => {
        throw new Error("connection reset");
      },
    } as unknown as SupabaseClient;
    assert.equal(await new CatalogTagger(offline, { send: fakeClaude().send, model: DEFAULT_MODEL }).tick(), TAGGER_DELAYS.error);
  });
});

describe("engine config for tagging", () => {
  it("is on with an Anthropic key, unless TAG_CATALOGS is 0", () => {
    assert.equal(loadConfig({}).tagCatalogs, false);
    assert.equal(loadConfig({ ANTHROPIC_API_KEY: "sk-ant-test" }).tagCatalogs, true);
    assert.equal(loadConfig({ ANTHROPIC_API_KEY: "sk-ant-test", TAG_CATALOGS: "0" }).tagCatalogs, false);
  });

  it("uses the tagging script's model and effort settings", () => {
    assert.deepEqual([loadConfig({}).tagModel, loadConfig({}).tagEffort], [DEFAULT_MODEL, "medium"]);
    const set = loadConfig({ WALKOFF_TAG_MODEL: "claude-sonnet-5-5", WALKOFF_TAG_EFFORT: "low" });
    assert.deepEqual([set.tagModel, set.tagEffort], ["claude-sonnet-5-5", "low"]);
    assert.throws(() => loadConfig({ WALKOFF_TAG_EFFORT: "extreme" }), /WALKOFF_TAG_EFFORT/);
  });
});
