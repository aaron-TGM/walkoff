import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { postalArea, toPostalArea, type Country } from "./geo";
import { sharesForArea, territory } from "./territories";

/** Share of an area's fans for a team, by abbreviation. */
function share(league: string, country: Country, code: string, abbr: string): number {
  const area = postalArea(country, code);
  assert.ok(area, `${country}:${code} missing`);
  return sharesForArea(league, area).find((s) => s.team.abbr === abbr)?.share ?? 0;
}

function top(league: string, country: Country, code: string): string {
  const area = postalArea(country, code)!;
  return sharesForArea(league, area)[0]?.team.abbr ?? "";
}

describe("fan territories match well-known fan maps", () => {
  it("NFL", () => {
    assert.ok(share("nfl", "US", "191", "PHI") > 0.9, "Philadelphia is Eagles");
    assert.equal(top("nfl", "US", "080"), "PHI", "South Jersey is Eagles");
    assert.ok(share("nfl", "US", "070", "PHI") < 0.1, "North Jersey is not Eagles");
    assert.equal(top("nfl", "US", "532"), "GB", "Milwaukee is Packers, not Bears");
    assert.equal(top("nfl", "US", "040"), "NE", "Maine is Patriots");
    assert.equal(top("nfl", "US", "972"), "SEA", "Portland, OR is Seahawks");
  });

  it("shared markets split by fan-base size", () => {
    assert.ok(share("mlb", "US", "100", "NYY") > share("mlb", "US", "100", "NYM"));
    assert.ok(share("mlb", "US", "606", "CHC") > share("mlb", "US", "606", "CHW"));
    assert.ok(share("nba", "US", "900", "LAL") > share("nba", "US", "900", "LAC"));
    assert.equal(top("mlb", "US", "958"), "SF", "Sacramento is still Giants country");
  });

  it("Canada", () => {
    assert.equal(top("nhl", "CA", "H3B"), "MTL");
    assert.equal(top("nhl", "CA", "R3B"), "WPG");
    assert.equal(top("mlb", "CA", "M5V"), "TOR");
  });

  it("college favors big in-state programs", () => {
    assert.equal(top("ncaaf", "US", "432"), "OSU");
    assert.equal(top("ncaaf", "US", "481"), "MICH");
    assert.equal(top("ncaaf", "US", "352"), "ALA", "Birmingham leans Alabama, then Auburn");
    assert.ok(share("ncaaf", "US", "436", "OSU") > 0.25, "Toledo has plenty of Buckeyes");
    assert.equal(top("ncaab", "US", "405"), "UK");
  });

  it("Premier League clubs own their own districts", () => {
    assert.equal(top("epl", "GB", "N17"), "TOT");
    assert.equal(top("epl", "GB", "N5"), "ARS");
    assert.equal(top("epl", "GB", "SE25"), "CRY");
    assert.equal(top("epl", "GB", "L4"), "LIV");
    assert.equal(top("epl", "GB", "M16"), "MAN");
    assert.equal(top("epl", "GB", "NE1"), "NEW");
  });

  it("shares in an area add up to 1", () => {
    for (const league of ["nfl", "ncaaf", "epl"]) {
      const t = territory(league);
      for (const shares of t.byArea.values()) {
        if (!shares.length) continue;
        const sum = shares.reduce((s, x) => s + x.share, 0);
        assert.ok(Math.abs(sum - 1) < 1e-9);
      }
    }
  });

  it("leagues only cover their own countries", () => {
    assert.deepEqual(sharesForArea("epl", postalArea("US", "191")!), []);
    assert.deepEqual(sharesForArea("nfl", postalArea("GB", "N17")!), []);
  });
});

describe("toPostalArea keeps only the coarse area", () => {
  it("US", () => {
    assert.deepEqual(toPostalArea("19147-1234"), { country: "US", code: "191" });
    assert.deepEqual(toPostalArea("2035", "US"), { country: "US", code: "020" });
    assert.deepEqual(toPostalArea("02035", "United States"), { country: "US", code: "020" });
  });

  it("Canada and the UK", () => {
    assert.deepEqual(toPostalArea("m5v 3l9"), { country: "CA", code: "M5V" });
    assert.deepEqual(toPostalArea("N17 0AP"), { country: "GB", code: "N17" });
    assert.deepEqual(toPostalArea("SW1A1AA", "GB"), { country: "GB", code: "SW1A" });
  });

  it("gives up on codes it can't place", () => {
    assert.equal(toPostalArea(""), null);
    assert.equal(toPostalArea("75001", "France"), null);
    assert.equal(toPostalArea("ABC"), null);
  });
});
