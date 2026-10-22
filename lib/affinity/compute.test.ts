import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeAffinity, type AreaCount, type ProductCount } from "./compute";
import { POSTAL_AREAS } from "./geo";

const US = POSTAL_AREAS.filter((a) => a.country === "US");
const usPopulation = US.reduce((s, a) => s + a.population, 0);
const PHILLY = new Set(["189", "190", "191", "193", "194", "080", "081", "083", "197", "198"]);

/** A brand whose customers follow population, except in Eagles country. */
function brand(total: number, phillyBoost: number): AreaCount[] {
  return US.map((a) => ({
    country: "US" as const,
    area: a.code,
    customers: Math.round(((total * a.population) / usPopulation) * (PHILLY.has(a.code) ? phillyBoost : 1)),
  }));
}

describe("computeAffinity", () => {
  it("finds the territory a brand over-indexes in", () => {
    const report = computeAffinity(brand(20_000, 3));
    assert.equal(report.standouts[0].abbr, "PHI", "a Philadelphia team leads");
    const eagles = report.standouts.find((s) => s.league === "nfl" && s.abbr === "PHI");
    assert.ok(eagles, "Eagles stand out");
    assert.ok(eagles.lift > 2, `lift ${eagles.lift}`);
    assert.ok(eagles.z > 10);
    // Teams with no boost sit near (slightly under) their population share.
    const cowboys = report.leagues.find((l) => l.league === "nfl")!.teams.find((t) => t.abbr === "DAL")!;
    assert.ok(cowboys.lift > 0.85 && cowboys.lift < 1.05, `Cowboys lift ${cowboys.lift}`);
    // Other Philly teams stand out too, in their own leagues.
    const leagues = new Set(report.standouts.filter((s) => s.teamName.includes("Philadelphia")).map((s) => s.league));
    assert.ok(leagues.has("mlb") && leagues.has("nba") && leagues.has("nhl"));
  });

  it("an even spread has no standouts", () => {
    const report = computeAffinity(brand(20_000, 1));
    assert.deepEqual(report.standouts, []);
  });

  it("a small sample isn't enough to call a standout", () => {
    const counts: AreaCount[] = [
      { country: "US", area: "191", customers: 4 },
      { country: "US", area: "100", customers: 3 },
      { country: "US", area: "606", customers: 3 },
    ];
    assert.deepEqual(computeAffinity(counts).standouts, []);
  });

  it("counts customers it can't place without guessing", () => {
    const report = computeAffinity([
      { country: "US", area: "191", customers: 10 },
      { country: "US", area: "000", customers: 4 },
      { country: "GB", area: "N17", customers: 6 },
    ]);
    assert.equal(report.totals.customers, 20);
    assert.equal(report.totals.matchedCustomers, 16);
    assert.equal(report.totals.unmatchedCustomers, 4);
    assert.deepEqual(report.totals.byCountry, { US: 10, GB: 6 });
    // UK customers only count toward the Premier League.
    assert.equal(report.leagues.find((l) => l.league === "epl")?.customers, 6);
    assert.equal(report.leagues.find((l) => l.league === "nfl")?.customers, 10);
  });

  it("names the products a territory buys more of", () => {
    const counts = brand(20_000, 3);
    const products: ProductCount[] = counts.flatMap((c) => [
      { country: "US", area: c.area, product: "Midweight Hoodie", orders: PHILLY.has(c.area) ? c.customers : c.customers * 0.2 },
      { country: "US", area: c.area, product: "Tumbler", orders: c.customers * 0.5 },
    ]);
    const report = computeAffinity(counts, {
      products,
      catalog: [{ title: "Bird Gang Tee", teams: [{ league: "nfl", teamId: "21" }] }],
    });
    const eagles = report.standouts.find((s) => s.abbr === "PHI" && s.league === "nfl")!;
    assert.equal(eagles.products[0]?.product, "Midweight Hoodie");
    assert.ok(eagles.products[0].lift > 1.5);
    assert.ok(!eagles.products.some((p) => p.product === "Tumbler"));
    assert.deepEqual(eagles.taggedProducts, ["Bird Gang Tee"]);
  });
});
