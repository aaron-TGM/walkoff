import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolveTown } from "../places";
import { nameKey } from "../places/names";
import { fakeDb } from "../testing/fake-db";
import {
  ACADEMIES,
  athleteId,
  athletePlace,
  athletesReady,
  CURATED_HOMES,
  curatedPlace,
  homePlaces,
  isAcademy,
  loadAthletes,
  momentHomes,
  namingRights,
  placesOf,
  saveAthletes,
  savePlaces,
  saveResults,
  sourceConfidence,
  walkoffAthleteId,
  type Athlete,
  type AthletePlace,
  type PlaceKind,
  type PlaceSource,
} from ".";

const DARNOLD = athleteId("football", "3912547");

/** What a source says, placed the way the sync will place it. */
async function said(kind: PlaceKind, source: PlaceSource, raw: string, town = raw): Promise<AthletePlace> {
  return athletePlace(DARNOLD, kind, source, raw, await resolveTown(town));
}

describe("where an athlete is from", () => {
  it("puts Sam Darnold in San Clemente, and only there", async () => {
    const places = [
      await said("birthplace", "espn", "Capistrano Beach, CA"),
      await said("high_school", "wikidata", "San Clemente High School", "San Clemente, CA"),
    ];
    const homes = homePlaces(places, ACADEMIES);
    assert.equal(homes.length, 1, "Capistrano Beach is 4 miles off: the same home");
    assert.equal(homes[0].placeKey, "census:0665084");
    assert.equal(homes[0].confidence, 0.9);
    assert.match(homes[0].ref, /^9267\d$/);
    assert.equal(homes[0].area, "926");
    assert.deepEqual(
      homes[0].from.map((f) => `${f.kind}:${f.source}`),
      ["high_school:wikidata", "birthplace:espn"],
    );
    assert.deepEqual(momentHomes(places, ACADEMIES), homes);
  });

  it("takes the curated file over the feeds, and an operator over both", async () => {
    const feeds = [
      await said("birthplace", "espn", "Capistrano Beach, CA"),
      await said("high_school", "wikidata", "Mater Dei High School", "Santa Ana, CA"),
    ];
    const curated = await said("hometown", "curated", "San Clemente, CA");
    assert.deepEqual(homePlaces([...feeds, curated]).map((h) => [h.placeKey, h.confidence]), [["census:0665084", 0.95]]);
    const fix = await said("hometown", "operator", "Dana Point, CA");
    assert.deepEqual(homePlaces([...feeds, curated, fix]).map((h) => [h.placeKey, h.confidence]), [["census:0617946", 1]]);
    // An operator's row they've ruled out counts for nothing.
    assert.equal(homePlaces([...feeds, curated, { ...fix, active: false }])[0].placeKey, "census:0665084");
  });

  it("doubts a boarding academy, and a high school far from the birthplace", async () => {
    const atlanta = await said("birthplace", "espn", "Atlanta, GA");
    const img = await said("high_school", "wikidata", "IMG Academy", "Bradenton, FL");
    assert.deepEqual(homePlaces([atlanta, img], ACADEMIES).map((h) => [h.name, h.confidence]), [["Atlanta", 0.7], ["Bradenton", 0.5]]);
    assert.deepEqual(momentHomes([atlanta, img], ACADEMIES).map((h) => h.name), ["Atlanta"]);
    const far = await said("high_school", "wikidata", "Central High School", "Knoxville, TN");
    assert.equal(homePlaces([atlanta, far]).find((h) => h.name === "Knoxville")?.confidence, 0.5, "150 miles from Atlanta");
  });

  it("keeps two homes only on two kinds of evidence", async () => {
    const atlanta = await said("birthplace", "espn", "Atlanta, GA");
    const athens = await said("high_school", "wikidata", "Clarke Central High School", "Athens, GA");
    assert.deepEqual(homePlaces([atlanta, athens]).map((h) => [h.name, h.confidence]), [["Athens", 0.9], ["Atlanta", 0.7]]);
    // Two birthplaces that disagree can't both be right.
    const chicago = await said("birthplace", "wikidata", "Chicago, IL");
    assert.deepEqual(homePlaces([atlanta, chicago]).map((h) => h.name), ["Atlanta"]);
  });

  it("passes over places it couldn't find, outside ones, and ones ruled out", async () => {
    const places = [
      await said("birthplace", "espn", "Springfield"),
      await said("birthplace", "wikidata", "Uppsala, Sweden"),
      { ...(await said("high_school", "wikidata", "San Clemente High School", "San Clemente, CA")), active: false },
    ];
    assert.deepEqual(places.map((p) => p.resolution), ["ambiguous", "outside", "found"]);
    assert.deepEqual(homePlaces(places), []);
  });

  it("weighs each source as the plan says", () => {
    assert.equal(sourceConfidence("hometown", "operator"), 1);
    assert.equal(sourceConfidence("hometown", "curated"), 0.95);
    assert.equal(sourceConfidence("high_school", "wikidata"), 0.9);
    assert.equal(sourceConfidence("birthplace", "espn"), 0.7);
    assert.equal(sourceConfidence("birthplace", "wikidata"), 0.65);
  });
});

describe("the curated file", () => {
  it("names each athlete by id, cites a source, and finds every hometown", async () => {
    assert.ok(CURATED_HOMES.length >= 1);
    assert.equal(new Set(CURATED_HOMES.map((h) => h.athlete)).size, CURATED_HOMES.length, "one entry per athlete");
    for (const h of CURATED_HOMES) {
      assert.match(h.athlete, /^(espn:[a-z-]+:\d+|walkoff:[a-z-]+:[a-z0-9-]+)$/, h.name);
      // A surfer's id is the one the surfing feed gives them, from their name.
      if (h.athlete.startsWith("walkoff:")) assert.equal(h.athlete, walkoffAthleteId(h.athlete.split(":")[1], h.name));
      assert.match(h.source, /^https:\/\//, h.name);
      const place = await curatedPlace(h);
      assert.equal(place.resolution, "found", `${h.name}: ${h.hometown}`);
      assert.ok(place.area, h.name);
    }
    const darnold = CURATED_HOMES.find((h) => h.athlete === DARNOLD)!;
    assert.equal((await curatedPlace(darnold)).placeKey, "census:0665084");
  });

  it("lists boarding academies, which a day school isn't", () => {
    assert.equal(new Set(ACADEMIES.map(nameKey)).size, ACADEMIES.length);
    assert.ok(isAcademy("IMG Academy", ACADEMIES));
    assert.ok(isAcademy("Montverde Academy (Florida)", ACADEMIES));
    assert.ok(!isAcademy("San Clemente High School", ACADEMIES));
  });
});

const athlete = (over: Partial<Athlete> = {}): Athlete => ({
  id: DARNOLD,
  sport: "football",
  league: "nfl",
  externalId: "3912547",
  displayName: "Sam Darnold",
  teamId: "espn:nfl:26",
  position: "QB",
  jersey: "14",
  rosterStatus: "active",
  college: "USC",
  ...over,
});

describe("storing athletes", () => {
  it("saves and reads athletes, their places and their results", async () => {
    const db = fakeDb();
    assert.equal(await athletesReady(db), true);
    await saveAthletes(db, [athlete()]);
    await saveAthletes(db, [athlete({ jersey: "15" })]);
    assert.equal(db.tables.athletes.length, 1);
    assert.equal(db.tables.athletes[0].name_key, "samdarnold");
    assert.deepEqual(await loadAthletes(db, [DARNOLD]), [athlete({ jersey: "15" })]);

    const birth = await said("birthplace", "espn", "Capistrano Beach, CA");
    await savePlaces(db, [birth]);
    await savePlaces(db, [{ ...birth, note: "checked" }]);
    assert.equal(db.tables.athlete_places.length, 1);
    assert.equal(db.tables.athlete_places[0].confidence, 0.7);
    assert.deepEqual(await placesOf(db, [DARNOLD]), [{ ...birth, note: "checked" }]);

    const result = {
      athleteId: DARNOLD,
      eventKey: "espn:nfl:401772988",
      eventName: "Super Bowl LX",
      kind: "title" as const,
      role: "leader" as const,
      teamId: "espn:nfl:26",
      momentId: null,
      intensity: 0.95,
      occurredAt: "2026-02-09T03:30:00Z",
      createdBy: "engine",
    };
    assert.equal(await saveResults(db, [result]), 1);
    assert.equal(await saveResults(db, [{ ...result, role: "played" }]), 0, "already on file");
    assert.equal(db.tables.athlete_results.length, 1);
    assert.equal(db.tables.athlete_results[0].role, "leader");
  });

  it("names an athlete only with written rights that are in date", async () => {
    const right = (over: Record<string, unknown>) => ({
      brand_id: "b1",
      athlete_id: DARNOLD,
      may_name: true,
      starts_on: "2026-01-01",
      ends_on: "2026-12-31",
      evidence: "NIL agreement 2026-014",
      recorded_by: "ops@walkoff.io",
      revoked_at: null,
      ...over,
    });
    const other = "espn:football:4000001";
    const db = fakeDb({
      brand_athlete_rights: [
        right({ id: "r1" }),
        right({ id: "r2", athlete_id: other, ends_on: "2026-06-30" }),
        right({ id: "r3", brand_id: "b2" }),
        right({ id: "r4", athlete_id: "espn:football:4000002", revoked_at: "2026-03-01T00:00:00Z" }),
        right({ id: "r5", athlete_id: "espn:football:4000003", may_name: false }),
        right({ id: "r6", athlete_id: "espn:football:4000004", starts_on: "2026-11-01" }),
      ],
    });
    const ids = [DARNOLD, other, "espn:football:4000002", "espn:football:4000003", "espn:football:4000004"];
    const rights = await namingRights(db, "b1", ids, "2026-10-25");
    assert.deepEqual([...rights.keys()], [DARNOLD]);
    assert.equal(rights.get(DARNOLD)?.evidence, "NIL agreement 2026-014");
    assert.deepEqual([...(await namingRights(db, "b1", ids, "2026-05-01")).keys()].sort(), [DARNOLD, other].sort());
  });

  it("reads nothing before 009_athletes.sql has run, and says so", async () => {
    const db = fakeDb({}, { through: "008" });
    assert.equal(await athletesReady(db), false);
    assert.deepEqual(await loadAthletes(db, [DARNOLD]), []);
    assert.deepEqual(await placesOf(db, [DARNOLD]), []);
    assert.equal((await namingRights(db, "b1", [DARNOLD])).size, 0);
    await assert.rejects(saveAthletes(db, [athlete()]), { code: "42P01" });
  });
});

describe("009_athletes.sql", () => {
  const sql = readFileSync(new URL("../../supabase/009_athletes.sql", import.meta.url), "utf8");

  it("is safe to run again", () => {
    for (const stmt of sql.match(/^(CREATE|ALTER) [^\n]*/gm) ?? []) {
      if (/ENABLE ROW LEVEL SECURITY/.test(stmt)) continue;
      assert.match(stmt, /IF NOT EXISTS/, stmt);
    }
  });

  it("keeps every new table behind RLS, with no policies", () => {
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
    assert.deepEqual(tables, ["athletes", "athlete_places", "roster_syncs", "athlete_results", "brand_athlete_rights"]);
    for (const t of tables) assert.match(sql, new RegExp(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`), t);
    assert.doesNotMatch(sql, /CREATE POLICY/i);
  });

  it("keeps no birth dates, ages or photos", () => {
    const code = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(code, /birth_?date|date_of_birth|\bage\b|photo|headshot/i);
  });
});
