import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { HometownDetail } from "../../lib/hometown";
import { fakeDb, type Row } from "../../lib/testing/fake-db";
import { tourById } from "../../lib/tours";
import { parseCoreBio } from "../circuits/bio";
import { CIRCUIT_POLL, type Bio } from "../circuits/poller";
import type { RacingFeed } from "./feed";
import { normalizeRaces } from "./normalize";
import { isMajorRace, RACING, raceOutcome } from "./outcome";
import { RacingPoller } from "./poller";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));
const NASCAR = tourById("nascar")!;
const F1 = tourById("f1")!;
const HOUR = 3_600_000;
const race = (series: string, name: string) => normalizeRaces(series, fixture(name))[0];

describe("normalizeRaces", () => {
  it("reads the race and its winner, and an F1 weekend's race session only", () => {
    const daytona = race("nascar", "racing-nascar-daytona-500-2026");
    assert.deepEqual([daytona.name, daytona.state, daytona.raceDate, daytona.winner?.name, daytona.winner?.externalId], ["Daytona 500", "final", "2026-02-15T18:30Z", "Tyler Reddick", "4577"]);
    const silverstone = race("f1", "racing-f1-british-gp-2026");
    assert.equal(silverstone.raceDate, "2026-07-05T14:00Z", "Sunday's race, not Friday's practice");
    assert.equal(silverstone.winner?.name, "Charles Leclerc");
  });

  it("keeps a weekend under way while a session is, and crowns no one before the race is final", () => {
    const board = fixture("racing-f1-british-gp-2026");
    const [fp1, , , , grandPrix] = board.events[0].competitions;
    fp1.status.type = { name: "STATUS_IN_PROGRESS", state: "in", completed: false };
    grandPrix.status.type = { name: "STATUS_SCHEDULED", state: "pre", completed: false };
    const [r] = normalizeRaces("f1", board);
    assert.deepEqual([r.state, r.winner], ["in", null]);
  });
});

describe("raceOutcome", () => {
  it("the Daytona 500 and the Indy 500 are majors; other wins count by series", () => {
    const daytona = race("nascar", "racing-nascar-daytona-500-2026");
    const o = raceOutcome(daytona, NASCAR, Date.parse(daytona.raceDate) + 4 * HOUR);
    assert.deepEqual([o?.kind, o?.players.map((p) => p.name), o?.intensity, o?.eventKey], ["win", ["Tyler Reddick"], RACING.major, "racing:nascar:daytona-500:2026-02-15"]);
    const indy = race("indycar", "racing-indycar-indy-500-2026");
    assert.equal(raceOutcome(indy, tourById("indycar")!, Date.parse(indy.raceDate) + HOUR)?.intensity, RACING.major);
    const talladega = race("nascar", "racing-nascar-talladega-2026");
    assert.equal(raceOutcome(talladega, NASCAR, Date.parse(talladega.raceDate) + HOUR)?.intensity, NASCAR.winIntensity);
    const silverstone = race("f1", "racing-f1-british-gp-2026");
    assert.equal(raceOutcome(silverstone, F1, Date.parse(silverstone.raceDate) + HOUR)?.intensity, F1.winIntensity);
  });

  it("knows the majors by name, and a Duel isn't the race", () => {
    for (const n of ["Daytona 500", "Indianapolis 500", "Indianapolis 500 presented by Gainbridge"]) assert.ok(isMajorRace(n), n);
    for (const n of ["Coca-Cola 600", "Grand Prix of Indianapolis", "Southern 500"]) assert.ok(!isMajorRace(n), n);
    const duel = { ...race("nascar", "racing-nascar-daytona-500-2026"), name: "Duel 1 at Daytona" };
    assert.equal(raceOutcome(duel, NASCAR, Date.parse(duel.raceDate) + HOUR), null);
  });

  it("only within 60 hours of the race", () => {
    const r = race("nascar", "racing-nascar-talladega-2026");
    assert.equal(raceOutcome(r, NASCAR, Date.parse(r.raceDate) + 61 * HOUR), null);
  });
});

describe("parseCoreBio", () => {
  it("reads racing's city and state, and tennis's one line", () => {
    assert.deepEqual(parseCoreBio({ birthPlace: { city: "Elk Grove", state: "CA" } }), { city: "Elk Grove", state: "CA", country: "" });
    assert.deepEqual(parseCoreBio({ birthPlace: { summary: "Irvine, CA, USA" } }), { city: "Irvine, CA, USA", state: "", country: "" });
    assert.equal(parseCoreBio({ birthPlace: {} }), null);
    assert.equal(parseCoreBio({ birthPlace: { summary: "N/A" } }), null);
    assert.equal(parseCoreBio({ birthPlace: { summary: "NOT KNOWN, ZZ" } }), null);
    assert.equal(parseCoreBio({ birthPlace: null }), null);
  });
});

describe("RacingPoller", () => {
  const BIOS: Record<string, Bio> = { "4577": { city: "Corning", state: "CA", country: "" }, "5498": { city: "Monte Carlo", state: "", country: "Monaco" } };
  const feedOf = (name: string): RacingFeed => ({
    scoreboard: async () => fixture(name),
    bio: async (_series, id) => BIOS[id] ?? null,
  });
  const moments = (db: { tables: Record<string, Row[]> }) => (db.tables.moments ?? []).filter((m) => String(m.type).startsWith("hometown_"));

  it("Daytona 500: Tyler Reddick's win makes Corning, California's moment, once", async () => {
    const db = fakeDb({});
    const at = Date.parse("2026-02-15T23:30:00Z");
    const p = new RacingPoller(NASCAR, db, feedOf("racing-nascar-daytona-500-2026"), { hometown: true, now: () => at });
    assert.equal(await p.tick(), CIRCUIT_POLL.idle);
    assert.equal(db.tables.athletes.find((a) => a.id === "espn:racing:4577")?.league, "nascar");
    const [result] = db.tables.athlete_results;
    assert.deepEqual([result.athlete_id, result.kind, result.intensity, result.event_name], ["espn:racing:4577", "win", 0.95, "Daytona 500"]);
    const [m] = moments(db);
    assert.equal(m.headline, "Hometown win: Tyler Reddick won the Daytona 500 · Corning, CA");
    assert.deepEqual([m.league, m.intensity, m.phase], ["nascar", 0.95, "season"]);
    assert.equal((m.detail as HometownDetail).town.big_city, false);
    await p.tick();
    assert.equal(moments(db).length, 1, "a repeat adds nothing");
    assert.equal(db.tables.engine_heartbeats[0].league, "racing:nascar");
  });

  it("a winner from outside the US, Canada and the UK has a result, and no town", async () => {
    const db = fakeDb({});
    const p = new RacingPoller(F1, db, feedOf("racing-f1-british-gp-2026"), { hometown: true, now: () => Date.parse("2026-07-05T18:00:00Z") });
    await p.tick();
    assert.equal(db.tables.athlete_results.length, 1);
    assert.equal(db.tables.athlete_places.find((x) => x.athlete_id === "espn:racing:5498")?.resolution, "outside");
    assert.deepEqual(moments(db), []);
  });
});
