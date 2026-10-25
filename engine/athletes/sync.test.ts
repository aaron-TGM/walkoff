import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { athleteId, momentHomes, placesOf, ACADEMIES } from "../../lib/athletes";
import { resolvePlace } from "../../lib/places";
import { fakeDb, type Row } from "../../lib/testing/fake-db";
import { parseRoster, type AthleteFeed, type RosterPlayer } from "./feed";
import { AthleteSync, SYNC, teamsFor } from "./sync";
import { parseLookup, WikidataBusy, type WikidataClient } from "./wikidata";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));
const SEAHAWKS = parseRoster(fixture("roster-nfl-seahawks"));
const WIKIDATA = parseLookup(fixture("wikidata-seahawks"));
const DARNOLD = athleteId("football", "3912547");
const HOUR = 3_600_000;
const START = Date.parse("2026-10-25T12:00:00Z");

/** A clock, and a database where every NFL team but Seattle synced an hour
 *  ago, so Seattle is the one due. */
function world(options: { through?: string } = {}) {
  const clock = { now: START };
  const iso = (t: number) => new Date(t).toISOString();
  const syncs = teamsFor(["nfl"])
    .filter((t) => t.id !== "espn:nfl:26")
    .map((t): Row => ({ team_id: t.id, league: "nfl", synced_at: iso(START - HOUR), athletes: 50, failures: 0, updated_at: iso(START - HOUR) }));
  const db = fakeDb(
    {
      roster_syncs: syncs,
      teams: [{ id: "espn:nfl:26", league: "nfl", external_id: "26", display_name: "Seattle Seahawks", color: "002a5c" }],
    },
    options,
  );
  const refresh = () => {
    for (const r of db.tables.roster_syncs) if (r.team_id !== "espn:nfl:26") r.synced_at = r.updated_at = iso(clock.now - HOUR);
  };
  return { clock, db, refresh };
}

function feedOf(rosters: () => RosterPlayer[] | Error) {
  const calls: string[] = [];
  const feed: AthleteFeed = {
    async roster(feedPath, teamId) {
      calls.push(`${feedPath}/${teamId}`);
      const r = rosters();
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { feed, calls };
}

function counting(resolve = resolvePlace) {
  const seen: string[] = [];
  return {
    seen,
    resolve: (b: { city: string; state: string; country: string }) => {
      seen.push(b.city);
      return resolve(b);
    },
  };
}

describe("the athlete sync", () => {
  it("syncs the team that's due: its players, reserves and birthplaces", async () => {
    const { clock, db } = world();
    const { feed, calls } = feedOf(() => SEAHAWKS);
    const sync = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata: null, now: () => clock.now });
    assert.equal(await sync.tick(), SYNC.busy);
    assert.deepEqual(calls, ["football/nfl/26"]);

    const athletes = db.tables.athletes;
    assert.equal(athletes.length, 83);
    assert.ok(athletes.every((a) => a.team_id === "espn:nfl:26" && a.league === "nfl"));
    assert.equal(athletes.filter((a) => a.roster_status === "reserve").length, 25);
    assert.equal(db.tables.teams[0].color, "002a5c", "the poller's team row is left alone");

    const [birth] = await placesOf(db, [DARNOLD]);
    assert.equal(birth.raw, "Capistrano Beach, CA, USA");
    assert.equal(birth.placeKey, "zip:92624");
    // ESPN's 83 birthplaces, and Sam Darnold's curated hometown, saved as
    // soon as he's on file.
    assert.equal(db.tables.athlete_places.length, 84);

    const row = db.tables.roster_syncs.find((r) => r.team_id === "espn:nfl:26")!;
    assert.equal(row.athletes, 83);
    assert.equal(row.failures, 0);
    const beat = db.tables.engine_heartbeats[0];
    assert.equal(beat.league, "athletes");
    assert.equal(beat.games, 32, "every NFL roster is under a day old");
    assert.ok(beat.last_ok_at);

    // Nothing else due: no feed calls.
    assert.equal(await sync.tick(), SYNC.idle);
    assert.equal(calls.length, 1);
  });

  it("rereads a roster a day later, clears players who left, and finds a birthplace again only when ESPN's text changes", async () => {
    const { clock, db, refresh } = world();
    let roster = SEAHAWKS;
    const { feed } = feedOf(() => roster);
    const spy = counting();
    const sync = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata: null, now: () => clock.now, resolve: spy.resolve });
    await sync.tick();
    assert.equal(spy.seen.length, 83);

    const gone = SEAHAWKS.find((p) => p.reserve)!;
    const moved = SEAHAWKS.find((p) => p.externalId !== DARNOLD.split(":")[2] && !p.reserve)!;
    roster = SEAHAWKS.filter((p) => p !== gone).map((p) => (p === moved ? { ...p, birthPlace: { city: "Tacoma", state: "WA", country: "USA" } } : p));
    clock.now += 25 * HOUR;
    refresh();
    spy.seen.length = 0;
    await sync.tick();
    assert.deepEqual(spy.seen, ["Tacoma"]);
    const left = db.tables.athletes.find((a) => a.id === athleteId("football", gone.externalId))!;
    assert.equal(left.team_id, null);
    assert.equal(left.roster_status, null);
    assert.equal(db.tables.athletes.filter((a) => a.team_id === "espn:nfl:26").length, 82);
  });

  it("counts a failed or empty roster against the team, and clears no one", async () => {
    const { clock, db, refresh } = world();
    let answer: RosterPlayer[] | Error = SEAHAWKS;
    const { feed, calls } = feedOf(() => answer);
    const sync = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata: null, now: () => clock.now });
    await sync.tick();

    clock.now += 25 * HOUR;
    refresh();
    answer = [];
    await sync.tick();
    const row = () => db.tables.roster_syncs.find((r) => r.team_id === "espn:nfl:26")!;
    assert.equal(row().failures, 1);
    assert.equal(row().last_error, "ESPN sent an empty roster");
    assert.equal(db.tables.athletes.filter((a) => a.team_id === "espn:nfl:26").length, 83, "no one cleared");

    // A failed team waits an hour per failure in a row.
    answer = new Error("HTTP 503 from ESPN");
    clock.now += 30 * 60_000;
    refresh();
    await sync.tick();
    assert.equal(calls.length, 2);
    clock.now += 31 * 60_000;
    refresh();
    await sync.tick();
    assert.equal(calls.length, 3);
    assert.equal(row().failures, 2);
    assert.equal(row().last_error, "HTTP 503 from ESPN");

    answer = SEAHAWKS;
    clock.now += 2 * HOUR;
    refresh();
    await sync.tick();
    assert.equal(row().failures, 0);
    assert.equal(row().last_error, null);
  });

  it("waits an hour when 009_athletes.sql hasn't run", async () => {
    const { clock, db } = world({ through: "008" });
    const { feed, calls } = feedOf(() => SEAHAWKS);
    const sync = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata: null, now: () => clock.now });
    assert.equal(await sync.tick(), SYNC.noTables);
    assert.deepEqual(calls, []);
  });

  it("asks Wikidata a batch at a time, keeps what it finds, and backs off when it's busy", async () => {
    const { clock, db } = world();
    const { feed } = feedOf(() => SEAHAWKS);
    const asked: string[][] = [];
    let busy = true;
    const wikidata: WikidataClient = {
      async lookup(league, ids) {
        assert.equal(league, "nfl");
        asked.push(ids);
        if (busy) throw new WikidataBusy(429, 120);
        return WIKIDATA.filter((w) => ids.includes(w.externalId));
      },
    };
    const sync = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata, now: () => clock.now });
    await sync.tick();
    assert.equal(asked.length, 1, "asked once, told to wait");
    clock.now += 10 * 60_000;
    await sync.tick();
    assert.equal(asked.length, 1, "still waiting: at least 15 minutes");

    busy = false;
    clock.now += 6 * 60_000;
    assert.equal(await sync.tick(), SYNC.busy);
    assert.equal(asked.length, 2);
    assert.equal(asked[1].length, 83);
    const athletes = db.tables.athletes;
    assert.ok(athletes.every((a) => a.wikidata_checked_at));
    assert.equal(athletes.filter((a) => a.wikidata_id).length, 53);
    assert.equal(athletes.find((a) => a.id === DARNOLD)!.wikidata_id, "Q27049069");

    const places = await placesOf(db, [DARNOLD]);
    const school = places.find((p) => p.kind === "high_school")!;
    assert.equal(school.raw, "San Clemente High School");
    assert.equal(school.placeKey, "census:0665084");
    const feeds = places.filter((p) => p.source !== "curated");
    assert.deepEqual(
      momentHomes(feeds, ACADEMIES).map((h) => [h.placeKey, h.confidence]),
      [["census:0665084", 0.9]],
      "from the feeds alone, Sam Darnold's home is San Clemente",
    );
    assert.deepEqual(momentHomes(places, ACADEMIES).map((h) => [h.placeKey, h.confidence]), [["census:0665084", 0.95]]);

    // No one left to ask: the next look is an hour off.
    await sync.tick();
    clock.now += 30 * 60_000;
    await sync.tick();
    assert.equal(asked.length, 2);
  });

  it("saves curated hometowns once the athlete is on file, and drops ones taken out of the file", async () => {
    const { clock, db, refresh } = world();
    let roster: RosterPlayer[] | Error = new Error("HTTP 500 from ESPN");
    const { feed } = feedOf(() => roster);
    const sync = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata: null, now: () => clock.now });
    await sync.tick();
    assert.equal((db.tables.athlete_places ?? []).length, 0, "Sam Darnold isn't on file yet");

    roster = SEAHAWKS;
    clock.now += 2 * HOUR;
    refresh();
    db.tables.athlete_places.push({ athlete_id: athleteId("football", "1"), kind: "hometown", source: "curated", raw: "Old Town, ME", resolution: "found" });
    await sync.tick();
    const curated = db.tables.athlete_places.filter((p) => p.source === "curated");
    assert.deepEqual(
      curated.map((p) => [p.athlete_id, p.raw, p.place_key]),
      [[DARNOLD, "San Clemente, CA", "census:0665084"]],
    );
  });
});
