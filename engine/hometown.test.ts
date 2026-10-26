import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { athleteId, athletePlace, CURATED_HOMES, curatedPlace, savePlaces } from "../lib/athletes";
import type { HometownDetail } from "../lib/hometown";
import { resolveTown } from "../lib/places";
import { fakeDb, type Row } from "../lib/testing/fake-db";
import { parseRoster, type AthleteFeed } from "./athletes/feed";
import { AthleteSync } from "./athletes/sync";
import { normalizeScoreboard, scoringEventsFromSummary } from "./espn/normalize";
import type { EspnSummary } from "./espn/types";
import { HOMETOWN, HometownJob } from "./hometown";
import { addHeroes } from "./moments/heroes";
import { finalMoments, track } from "./moments/rules";
import { rulesFor } from "./moments/sports";
import { momentRow } from "./store/supabase";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"));
const SEAHAWKS = parseRoster(fixture("roster-nfl-seahawks"));
const DARNOLD = athleteId("football", "3912547");
const HOUR = 3_600_000;
const FINAL_AT = "2026-02-09T03:10:00.000Z";
const SAN_CLEMENTE = "census:0665084";

/** Super Bowl LX's title, as the poller saves it, with or without the
 *  summary's heroes. */
function title(withHeroes = true): Row {
  const g = normalizeScoreboard("nfl", fixture("nfl-super-bowl-lx"))[0];
  const summary = fixture("nfl-summary-401772988") as EspnSummary;
  const now = new Date(FINAL_AT);
  const finals = finalMoments(track(null, g, now), rulesFor("nfl"), scoringEventsFromSummary("football", summary), now);
  const m = (withHeroes ? addHeroes(finals, "football", summary) : finals).find((x) => x.type === "title_won");
  assert.ok(m);
  return { id: randomUUID(), ...momentRow(m), detected_at: FINAL_AT };
}

/** The night of the Super Bowl: the title saved, Darnold's curated
 *  hometown on file, and Seattle's roster to read. */
async function night(options: { withHeroes?: boolean; through?: string } = {}) {
  const clock = { now: Date.parse(FINAL_AT) + 10 * 60_000 };
  const db = fakeDb(
    {
      teams: [
        { id: "espn:nfl:26", league: "nfl", external_id: "26", display_name: "Seattle Seahawks" },
        { id: "espn:nfl:17", league: "nfl", external_id: "17", display_name: "New England Patriots" },
      ],
      moments: [title(options.withHeroes ?? true)],
    },
    { through: options.through },
  );
  const reads: string[] = [];
  const feed: AthleteFeed = {
    async roster(feedPath, teamId) {
      reads.push(`${feedPath}/${teamId}`);
      return SEAHAWKS;
    },
  };
  const rosters = new AthleteSync(db, feed, { leagues: ["nfl"], wikidata: null, now: () => clock.now });
  if (!options.through) await savePlaces(db, [await curatedPlace(CURATED_HOMES.find((h) => h.athlete === DARNOLD)!)]);
  const job = new HometownJob(db, { rosters, now: () => clock.now });
  return { clock, db, job, reads };
}

const hometown = (db: { tables: Record<string, Row[]> }) => (db.tables.moments ?? []).filter((m) => m.type === "hometown_title");

describe("HometownJob", () => {
  it("Super Bowl LX: a moment for San Clemente, with Darnold as passing leader", async () => {
    const { db, job, reads } = await night();
    assert.equal(await job.tick(), HOMETOWN.every);

    // Seattle's roster had never been read, so it was read first.
    assert.deepEqual(reads, ["football/nfl/26"]);
    const results = db.tables.athlete_results;
    assert.equal(results.length, SEAHAWKS.length);
    const darnold = results.find((r) => r.athlete_id === DARNOLD);
    assert.equal(darnold?.role, "leader");
    assert.equal(darnold?.intensity, 0.95);
    assert.equal(darnold?.event_key, "espn:nfl:401772988");
    assert.equal(darnold?.event_name, "Super Bowl LX");
    assert.equal(results.find((r) => r.athlete_id === athleteId("football", "4362851"))?.role, "leader", "Ernest Jones IV, tackles");
    assert.ok(results.some((r) => r.role === "played"));
    assert.ok(results.some((r) => r.role === "reserve"));

    const towns = hometown(db);
    assert.ok(towns.length >= 20, `${towns.length} towns`);
    const sc = towns.find((m) => m.place_key === SAN_CLEMENTE);
    assert.ok(sc, "San Clemente");
    assert.equal(sc.athlete_id, DARNOLD);
    assert.equal(sc.intensity, 0.95);
    assert.equal(sc.team_id, "espn:nfl:26");
    assert.equal(sc.dedupe_key, `hometown_title:espn:nfl:401772988:${SAN_CLEMENTE}`);
    assert.equal(sc.headline, "Hometown champion: Sam Darnold (QB) won Super Bowl LX with the Seattle Seahawks · San Clemente, CA");
    const detail = sc.detail as HometownDetail;
    assert.equal(detail.town.ref, "92673");
    assert.deepEqual(detail.athletes[0].led, ["Passing Yards"]);
    assert.equal(detail.athletes[0].from[0].source, "curated");
    // The curated hometown replaces his birthplace, 4 miles away.
    assert.ok(!towns.some((m) => m.athlete_id === DARNOLD && m.place_key !== SAN_CLEMENTE));
    // No big city makes a moment from a birthplace alone.
    assert.ok(towns.every((m) => !(m.detail as HometownDetail).town.big_city));
    assert.equal(new Set(towns.map((m) => m.dedupe_key)).size, towns.length);
    assert.equal(db.tables.engine_heartbeats.find((h) => h.league === "hometown")?.games, towns.length);
  });

  it("a repeat adds nothing, and a hometown fixed later adds the new town", async () => {
    const { clock, db, job, reads } = await night();
    await job.tick();
    const before = hometown(db).length;
    clock.now += HOUR;
    await job.tick();
    assert.equal(hometown(db).length, before);
    assert.equal(reads.length, 1, "the roster is read once");

    const dana = await resolveTown("Dana Point, CA");
    assert.equal(dana.status, "found");
    await savePlaces(db, [athletePlace(DARNOLD, "hometown", "operator", "Dana Point, CA", dana, "test")], "ops@walkoff.io");
    await job.tick();
    const now = hometown(db);
    assert.equal(now.length, before + 1);
    assert.ok(now.some((m) => m.place_key === SAN_CLEMENTE), "the old town keeps its moment");
    assert.ok(now.some((m) => m.athlete_id === DARNOLD && m.place_key !== SAN_CLEMENTE), "Dana Point");

    // After 72 hours the title is done.
    clock.now = Date.parse(FINAL_AT) + 73 * HOUR;
    db.tables.athlete_places = db.tables.athlete_places.filter((p) => !(p.athlete_id === DARNOLD && p.source === "operator"));
    await savePlaces(db, [athletePlace(DARNOLD, "hometown", "operator", "Boise, ID", await resolveTown("Boise, ID"), "test")], "ops@walkoff.io");
    await job.tick();
    assert.equal(hometown(db).length, before + 1);
    assert.ok(!hometown(db).some((m) => String(m.headline).endsWith("Boise, ID")));
  });

  it("without the summary's heroes, everyone counts by the roster", async () => {
    const { db, job } = await night({ withHeroes: false });
    await job.tick();
    const roles = new Set(db.tables.athlete_results.map((r) => r.role));
    assert.deepEqual([...roles].sort(), ["reserve", "roster"]);
    assert.equal(hometown(db).find((m) => m.place_key === SAN_CLEMENTE)?.intensity, 0.75);
  });

  it("skips a retracted title", async () => {
    const { db, job } = await night();
    db.tables.moments[0].retracted_at = new Date().toISOString();
    await job.tick();
    assert.equal(db.tables.athlete_results?.length ?? 0, 0);
    assert.equal(hometown(db).length, 0);
  });

  it("waits for 009_athletes.sql", async () => {
    const { db, job, reads } = await night({ through: "008" });
    assert.equal(await job.tick(), HOMETOWN.noTables);
    assert.equal(reads.length, 0);
    assert.equal(db.tables.moments.length, 1);
  });
});
