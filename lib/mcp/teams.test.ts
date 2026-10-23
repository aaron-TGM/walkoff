import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { feedIdOf, findTeams, resolveTeam, sameSchool, teamByKey, teamFromFeedId } from "./teams";

describe("findTeams", () => {
  it("finds a team by nickname, full name, abbreviation or key", () => {
    assert.equal(findTeams("Chargers")[0].key, "nfl:24");
    assert.deepEqual(findTeams("los angeles chargers").map((t) => t.key), ["nfl:24"]);
    assert.deepEqual(findTeams("nfl:24").map((t) => t.team.abbr), ["LAC"]);
    assert.equal(findTeams("Tottenham Hotspur")[0].league, "epl");
  });

  it("returns every team a name could mean, and a league narrows it", () => {
    const lac = findTeams("LAC");
    assert.ok(lac.length >= 2, "the Chargers and the Clippers");
    assert.deepEqual(findTeams("LAC", "nba").map((t) => t.team.nickname), ["Clippers"]);
  });

  it("a full name beats a city, and LA is Los Angeles", () => {
    const la = findTeams("Los Angeles");
    assert.ok(la.length > 3);
    assert.ok(la.every((t) => ["Los Angeles", "LA"].includes(t.team.location)));
    assert.deepEqual(findTeams("LA").map((t) => t.key).sort(), la.map((t) => t.key).sort());
    assert.ok(la.some((t) => t.team.nickname === "Clippers"), "the LA Clippers count");
  });

  it("a school is one school across football and basketball", () => {
    const michigan = findTeams("Michigan Wolverines");
    assert.ok(sameSchool(michigan));
    assert.ok(!sameSchool(findTeams("LAC")));
  });

  it("resolves to one team: the brand's own, then pro, then football", () => {
    const pick = (q: string, opts?: Parameters<typeof resolveTeam>[1]) => {
      const r = resolveTeam(q, opts);
      return "team" in r ? r.team.key : r.error;
    };
    assert.equal(pick("Chargers"), "nfl:24", "the NFL team over a college team with the same nickname");
    assert.equal(pick("LAC", { prefer: ["nba:12"] }), "nba:12", "the brand's own territory");
    assert.match(pick("LAC"), /could mean/);
    assert.match(pick("LAC", { prefer: ["nfl:24", "nba:12"] }), /could mean/, "both are the brand's");
    assert.match(pick("LA"), /could mean/);
    assert.equal(pick("Michigan Wolverines"), "ncaaf:130");
    assert.match(pick("Nowhere Nobodies"), /No team matches/);
  });

  it("round-trips feed ids", () => {
    const t = teamByKey("nfl:24")!;
    assert.equal(feedIdOf(t), "espn:nfl:24");
    assert.equal(teamFromFeedId("espn:nfl:24")?.team.nickname, "Chargers");
    assert.equal(teamFromFeedId("espn:nfl:999999"), null);
    assert.equal(teamFromFeedId(null), null);
  });
});
