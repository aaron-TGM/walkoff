import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { normalizeScoreboard, parseClock, parseMinute } from "./normalize";

function board(name: string) {
  return JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));
}

describe("parsers", () => {
  it("reads soccer minutes with stoppage time", () => {
    assert.equal(parseMinute("88'"), 88);
    assert.equal(parseMinute("90'+6'"), 96);
    assert.equal(parseMinute("45'+1'"), 46);
    assert.equal(parseMinute("HT"), null);
  });

  it("reads game clocks", () => {
    assert.equal(parseClock("5:23"), 323);
    assert.equal(parseClock("1.4"), 1.4);
    assert.equal(parseClock("0:00"), 0);
    assert.equal(parseClock(undefined), null);
  });
});

describe("normalizeScoreboard", () => {
  it("builds engine ids and team details", () => {
    const [g] = normalizeScoreboard("mlb", board("mlb-nlds-walkoff"));
    assert.equal(g.id, "espn:mlb:401908003");
    assert.equal(g.home.team.id, "espn:mlb:8");
    assert.equal(g.home.team.shortName, "Brewers");
    assert.equal(g.headline, "NLDS - Game 2");
    assert.equal(g.seasonType, 3);
    assert.equal(g.state, "post");
    assert.equal(g.completed, true);
    assert.equal(g.home.linescores.length, 9);
  });

  it("knows who won a completed series", () => {
    const [g] = normalizeScoreboard("mlb", board("mlb-nlcs-clinch"));
    assert.equal(g.series?.completed, true);
    assert.equal(g.series?.winnerExternalId, g.away.team.externalId);
  });

  it("keeps soccer goals in match order with own goals credited", () => {
    const g = normalizeScoreboard("epl", board("epl-0830")).find((x) => x.shortName === "BHA @ CHE");
    assert.ok(g);
    assert.deepEqual(
      g.goals.map((x) => x.minute),
      [4, 14, 32, 35, 63, 74, 96],
    );
    const own = g.goals.find((x) => x.ownGoal);
    assert.equal(own?.teamExternalId, g.away.team.externalId, "own goal counts for Brighton");
  });

  it("marks timed-sport clocks and leaves them off other sports", () => {
    const [nba] = normalizeScoreboard("nba", board("nba-1021"));
    assert.equal(typeof nba.clockSeconds, "number");
    const [mlb] = normalizeScoreboard("mlb", board("mlb-nlds-walkoff"));
    assert.equal(mlb.clockSeconds, null);
  });
});
