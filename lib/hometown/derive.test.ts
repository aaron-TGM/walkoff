import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Athlete, AthleteResult, Home } from "../athletes";
import type { Place, TownCircle } from "../places";
import { hometownCopy } from "./copy";
import { deriveHometownMoments, ROLE_INTENSITY, type HometownEvent, type Local, type Town } from "./derive";

const athlete = (id: string, name: string, position: string | null = "QB"): Athlete => ({
  id,
  sport: "football",
  league: "nfl",
  externalId: id.split(":")[2],
  displayName: name,
  teamId: "espn:nfl:26",
  position,
  jersey: null,
  rosterStatus: "active",
  college: null,
});

const home = (placeKey: string, source: "operator" | "curated" | "wikidata" | "espn", confidence: number): Home => ({
  placeKey,
  name: placeKey,
  region: "CA",
  country: "US",
  lat: 33.4,
  lng: -117.6,
  ref: "92673",
  area: "926",
  confidence,
  from: [{ kind: source === "espn" ? "birthplace" : source === "wikidata" ? "high_school" : "hometown", source, raw: placeKey }],
});

const town = (key: string, name: string, bigCity = false): Town => ({
  place: { key, name, names: [name], country: "US", region: "CA", lat: 33.4, lng: -117.6, ref: "92673", radius: 2, section: false } as Place,
  label: `${name}, CA`,
  circle: { country: "US", ref: "92673", lat: 33.4, lng: -117.6, radiusMiles: 5, population: bigCity ? 2_000_000 : 97_546, bigCity, shares: {}, method: "" } as TownCircle,
});

const EVENT: HometownEvent = {
  key: "espn:nfl:401772988",
  name: "Super Bowl LX",
  kind: "title",
  league: "nfl",
  gameId: "espn:nfl:401772988",
  teamId: "espn:nfl:26",
  teamName: "Seattle Seahawks",
  opponentTeamId: "espn:nfl:17",
  occurredAt: "2026-02-09T03:10:00.000Z",
};

const local = (a: Athlete, role: AthleteResult["role"], homes: Home[], led?: string[]): Local => ({
  athlete: a,
  result: { athleteId: a.id, eventKey: EVENT.key, eventName: EVENT.name, kind: "title", role, teamId: EVENT.teamId, momentId: null, intensity: ROLE_INTENSITY[role], occurredAt: EVENT.occurredAt, createdBy: "engine" },
  homes,
  led,
});

const TOWNS = new Map([
  ["census:0665084", town("census:0665084", "San Clemente")],
  ["census:0644000", town("census:0644000", "Los Angeles", true)],
]);

describe("deriveHometownMoments", () => {
  it("makes one moment per town, its most prominent athlete first", () => {
    const darnold = athlete("espn:football:3912547", "Sam Darnold");
    const other = athlete("espn:football:5000001", "Pat Reserve", "LB");
    const [m, ...rest] = deriveHometownMoments(
      EVENT,
      [local(other, "reserve", [home("census:0665084", "espn", 0.7)]), local(darnold, "leader", [home("census:0665084", "curated", 0.95)], ["Passing Yards"])],
      TOWNS,
    );
    assert.deepEqual(rest, []);
    assert.equal(m.dedupeKey, "hometown_title:espn:nfl:401772988:census:0665084");
    assert.equal(m.athleteId, darnold.id);
    assert.equal(m.intensity, 0.95);
    assert.equal(m.phase, "season");
    assert.equal(m.headline, "Hometown champions: Sam Darnold (QB) and Pat Reserve (LB) won Super Bowl LX with the Seattle Seahawks · San Clemente, CA");
    assert.deepEqual(m.detail.athletes.map((a) => [a.name, a.role, a.led ?? null]), [
      ["Sam Darnold", "leader", ["Passing Yards"]],
      ["Pat Reserve", "reserve", null],
    ]);
    assert.equal(m.detail.town.radius_miles, 5);
  });

  it("makes none in a big city unless a person set the home", () => {
    const born = local(athlete("espn:football:1", "Born There"), "played", [home("census:0644000", "espn", 0.7)]);
    assert.deepEqual(deriveHometownMoments(EVENT, [born], TOWNS), []);
    const set = local(athlete("espn:football:2", "Set There"), "played", [home("census:0644000", "operator", 1)]);
    assert.equal(deriveHometownMoments(EVENT, [set], TOWNS)[0].placeKey, "census:0644000");
  });

  it("reads right for a win and a contender", () => {
    const a = athlete("walkoff:surfing:griffin-colapinto", "Griffin Colapinto", null);
    const win = deriveHometownMoments({ ...EVENT, kind: "win", name: "WSL Finals", teamName: null }, [local(a, "leader", [home("census:0665084", "operator", 1)])], TOWNS)[0];
    assert.equal(win.headline, "Hometown win: Griffin Colapinto won the WSL Finals · San Clemente, CA");
    assert.equal(win.type, "hometown_win");
    const lead = deriveHometownMoments({ ...EVENT, kind: "lead", name: "Masters", teamName: null }, [local(a, "leader", [home("census:0665084", "operator", 1)])], TOWNS)[0];
    assert.equal(lead.headline, "Hometown contender: Griffin Colapinto leads the Masters going into the final round · San Clemente, CA");
    assert.equal(lead.phase, "before");
  });
});

describe("hometownCopy", () => {
  const base = { type: "hometown_title" as const, town: "San Clemente", colors: { phrase: "navy and lime", main: "navy" }, partOfDay: "night" as const, when: "tomorrow", product: null, mayName: null };

  it("celebrates the town in the champion's colors", () => {
    const c = hometownCopy(base);
    assert.deepEqual(c.subjects, ["San Clemente, what a night.", "Navy and lime all over San Clemente today.", "Big night for San Clemente."]);
    assert.equal(c.body, "San Clemente has a lot to celebrate today. We picked a few things in the colors everyone there is wearing.");
  });

  it("names an athlete only when the brand may", () => {
    const c = hometownCopy({ ...base, mayName: "Sam Darnold" });
    assert.equal(c.subjects[0], "Sam Darnold did it. San Clemente, what a night.");
    assert.match(c.body, /^Sam Darnold did it, and San Clemente/);
  });

  it("has no colors to name for an athlete without a team", () => {
    const c = hometownCopy({ ...base, type: "hometown_win", colors: null, partOfDay: "day" });
    assert.deepEqual(c.subjects, ["San Clemente, what a day.", "San Clemente is celebrating.", "Big day for San Clemente."]);
    assert.equal(c.preview, "A few things for San Clemente to celebrate in.");
  });
});
