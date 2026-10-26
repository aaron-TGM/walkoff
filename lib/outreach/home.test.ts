import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { homeTeams, locate, PITCH_LEAGUES, teamKeys, type ProspectPlace } from "./home";

const place = (p: Partial<ProspectPlace>): ProspectPlace => ({
  country: null,
  region: null,
  city: null,
  postal_code: null,
  lat: null,
  lng: null,
  ...p,
});

describe("locate", () => {
  it("uses the headquarters' coordinates first", async () => {
    const r = await locate(place({ country: "US", lat: 32.7157, lng: -117.1611, postal_code: "19147" }));
    assert.deepEqual([r.area?.key, r.how], ["US:921", "coordinates"]);
  });

  it("falls back to the postal code, then the city", async () => {
    const byCode = await locate(place({ country: "US", postal_code: "19147-1234" }));
    assert.deepEqual([byCode.area?.key, byCode.how], ["US:191", "postal code"]);
    const byCity = await locate(place({ country: "United States", region: "California", city: "San Clemente" }));
    assert.deepEqual([byCity.area?.key, byCity.how], ["US:926", "city"]);
  });

  it("places nothing outside the US, Canada and the UK", async () => {
    const r = await locate(place({ country: "DE", city: "Berlin", lat: 52.52, lng: 13.4 }));
    assert.deepEqual([r.area, r.how], [null, "unplaced"]);
  });

  it("finds the country from coordinates when the export has none", async () => {
    const r = await locate(place({ lat: 40.7128, lng: -74.006 }));
    assert.equal(r.area?.country, "US");
  });
});

describe("homeTeams", () => {
  it("is the team most local fans follow, in each league that's playing", async () => {
    const { area } = await locate(place({ country: "US", postal_code: "19147" }));
    const teams = homeTeams(area!);
    assert.ok(!PITCH_LEAGUES.includes("mlb"), "MLB starts on Opening Day 2027");
    assert.deepEqual(
      teams.filter((t) => t.key.startsWith("nfl:") || t.key.startsWith("nba:") || t.key.startsWith("nhl:")).map((t) => t.name),
      ["Philadelphia Eagles", "Philadelphia 76ers", "Philadelphia Flyers"],
    );
    assert.ok(teams.every((t) => !t.key.startsWith("mlb:")));
  });

  it("keeps both teams in a shared market", async () => {
    const { area } = await locate(place({ country: "US", region: "CA", city: "San Clemente" }));
    const nfl = homeTeams(area!).filter((t) => t.key.startsWith("nfl:"));
    assert.deepEqual(nfl.map((t) => t.name).sort(), ["Los Angeles Chargers", "Los Angeles Rams"]);
  });

  it("takes other leagues when asked", async () => {
    const { area } = await locate(place({ country: "US", lat: 32.7157, lng: -117.1611 }));
    assert.deepEqual(homeTeams(area!, ["mlb"]).map((t) => t.name), ["San Diego Padres"]);
  });

  it("counts a school once, by its football team", async () => {
    const { area } = await locate(place({ country: "US", lat: 32.7157, lng: -117.1611 }));
    const ucla = homeTeams(area!).filter((t) => t.name === "UCLA Bruins");
    assert.deepEqual(ucla.map((t) => t.key), ["ncaaf:26"]);
  });
});

describe("teamKeys", () => {
  it("gives a school's football and basketball keys, and a pro team's own", () => {
    assert.deepEqual(teamKeys("ncaaf:26"), ["ncaaf:26", "ncaab:26"]);
    assert.deepEqual(teamKeys("nfl:24"), ["nfl:24"]);
  });
});
