import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postalArea } from "../affinity/geo";
import type { CatalogItem } from "../affinity/imports";
import type { Pick } from "../affinity/pick";
import { feedProduct, fakeStorefront } from "../testing/fake-store";
import { homeTeams } from "./home";
import { QUALIFY, scoreCatalog, scoreProspect, teamScore } from "./score";

const item = (title: string, colors: string[], photo = true): CatalogItem => ({
  handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  title,
  productType: "Hoodie",
  category: "",
  tags: [],
  description: "",
  price: 58,
  colorways: colors.map((name) => ({ name, skus: [`${title}-${name}`], image: photo ? `https://cdn.example.com/${name}.jpg` : "" })),
});

// The demo brand's catalog (lib/affinity/demo.ts), in Chargers colors.
const ATHLEISURE = [
  item("Everyday Jogger", ["Azure Heather", "Midnight", "Heather Grey", "Black"]),
  item("Sunday Hoodie", ["Sunflower", "Dune", "Black", "Pine"]),
  item("Performance Tee", ["Royal", "Salt", "Marigold", "Charcoal"]),
  item("Coastal Crew", ["Violet", "Bone", "Kelly", "Gold"]),
];

const SAN_DIEGO = homeTeams(postalArea("US", "921")!);
const LAS_VEGAS = homeTeams(postalArea("US", "891")!);

const pick = (score: number, image = "x.jpg"): Pick => ({ title: "P", colorway: "C", hex: [], skus: [], image, why: "", score });

describe("teamScore", () => {
  it("averages three slots, halving a pick without a photo", () => {
    assert.equal(teamScore([pick(1), pick(0.8), pick(0.6)]), 0.8);
    assert.equal(teamScore([pick(1), pick(0.8, ""), pick(0.6)]), 0.67);
    assert.equal(teamScore([pick(0.9)]), 0.3);
    assert.equal(teamScore([pick(2.4), pick(1), pick(1)]), 1);
    assert.equal(teamScore([]), 0);
  });
});

describe("scoreCatalog", () => {
  it("qualifies a store whose products wear a home team's colors", () => {
    const r = scoreCatalog(ATHLEISURE, SAN_DIEGO);
    assert.equal(r.verdict, "qualified");
    assert.equal(r.best?.name, "Los Angeles Chargers");
    assert.ok(r.score >= QUALIFY);
    assert.deepEqual(r.best?.picks.map((p) => p.colorway), ["Azure Heather", "Sunflower", "Gold"]);
    assert.ok(r.best?.picks.every((p) => p.skus.length === 0), "picks are saved without SKUs");
    assert.deepEqual([r.products, r.colorways], [4, 16]);
    assert.match(r.reason, /^Wears the Los Angeles Chargers well/);
  });

  it("skips a store with nothing in its teams' colors, and says why", () => {
    const r = scoreCatalog([item("Core Tee", ["Black", "White"]), item("Core Hoodie", ["Black", "Charcoal"])], LAS_VEGAS);
    assert.equal(r.verdict, "skipped");
    assert.match(r.reason, /^Too few products in its home teams' colors/);
  });

  it("skips a store with no home teams", () => {
    const r = scoreCatalog(ATHLEISURE, []);
    assert.deepEqual([r.verdict, r.best], ["skipped", null]);
    assert.match(r.reason, /isn't placed/);
  });

  it("counts photos: swatches alone don't make a pitch", () => {
    assert.equal(scoreCatalog(ATHLEISURE.map((i) => item(i.title, i.colorways.map((c) => c.name), false)), SAN_DIEGO).verdict, "skipped");
  });

  it("goes by color, not by team words in the text", () => {
    const tee = { ...item("Stardust Tee", ["Black"]), description: "Scribbles and diamante stars all over." };
    const r = scoreCatalog([tee], homeTeams(postalArea("US", "752")!));
    assert.ok(r.teams.every((t) => t.picks.every((p) => p.why !== "Made for their fans")));
  });
});

describe("scoreProspect", () => {
  const colors = ["Azure Heather", "Sunflower", "Gold"];

  it("reads the store's public feed", async () => {
    const store = fakeStorefront({ host: "shop.example.com", products: [0, 1, 2].map((i) => feedProduct(i, { colors })) });
    const r = await scoreProspect("https://shop.example.com", SAN_DIEGO, store);
    assert.equal(r.verdict, "qualified");
    assert.equal(r.products, 3);
    assert.equal(r.note, undefined);
  });

  it("reads four pages at most, and says so", async () => {
    const store = fakeStorefront({ host: "shop.example.com", products: Array.from({ length: 1001 }, (_, i) => feedProduct(i, { colors })) });
    const r = await scoreProspect("https://shop.example.com", SAN_DIEGO, store);
    assert.equal(store.requests.length, 4);
    assert.equal(r.note, "Read the first 1,000 products.");
  });

  it("doesn't read a store with no home teams", async () => {
    const store = fakeStorefront({ host: "shop.example.com", products: [feedProduct(0, { colors })] });
    const r = await scoreProspect("https://shop.example.com", [], store);
    assert.deepEqual([r.verdict, store.requests.length], ["skipped", 0]);
  });

  it("skips a store whose feed can't be read", async () => {
    const store = fakeStorefront({ host: "shop.example.com", products: [], password: true });
    const r = await scoreProspect("https://shop.example.com", SAN_DIEGO, store);
    assert.equal(r.verdict, "skipped");
    assert.match(r.reason, /password protected/);
  });
});
