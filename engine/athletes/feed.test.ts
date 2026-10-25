import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { birthPlaceText, createAthleteFeed, parseRoster } from "./feed";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));

describe("ESPN rosters", () => {
  it("reads the NFL's grouped roster, reserves included", () => {
    const players = parseRoster(fixture("roster-nfl-seahawks"));
    assert.equal(players.length, 83);
    assert.equal(players.filter((p) => p.reserve).length, 25, "7 hurt and 18 on the practice squad");
    assert.equal(players.filter((p) => p.birthPlace).length, 83);
    const darnold = players.find((p) => p.externalId === "3912547");
    assert.deepEqual(darnold, {
      externalId: "3912547",
      displayName: "Sam Darnold",
      position: "QB",
      jersey: "14",
      reserve: false,
      college: "USC",
      birthPlace: { city: "Capistrano Beach", state: "CA", country: "USA" },
    });
    assert.equal(birthPlaceText(darnold!.birthPlace!), "Capistrano Beach, CA, USA");
  });

  it("reads a flat roster, and a hockey roster's country codes", () => {
    assert.equal(parseRoster(fixture("roster-nba-lakers")).length, 18);
    const ducks = parseRoster(fixture("roster-nhl-ducks"));
    assert.equal(ducks.length, 29);
    assert.deepEqual(ducks.find((p) => p.displayName === "Leo Carlsson")?.birthPlace, { city: "Karlstad", state: "", country: "SWE" });
    assert.ok(ducks.every((p) => !p.reserve));
  });

  it("has no birthplace for Premier League players", () => {
    const arsenal = parseRoster(fixture("roster-epl-arsenal"));
    assert.equal(arsenal.length, 29);
    assert.ok(arsenal.every((p) => p.birthPlace === null));
  });

  it("asks ESPN for the team's roster", async () => {
    const urls: string[] = [];
    const feed = createAthleteFeed({
      fetchImpl: (async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify(fixture("roster-nba-lakers")), { status: 200 });
      }) as typeof fetch,
    });
    assert.equal((await feed.roster("basketball/nba", "13")).length, 18);
    assert.deepEqual(urls, ["https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/13/roster"]);
  });
});
