import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { athleteId, athletePlace, savePlaces } from "../athletes";
import { resolveTown } from "../places";
import { fakeDb, type Row } from "../testing/fake-db";
import type { Principal } from "./data";
import { createWalkoffServer, OPERATOR_INSTRUCTIONS } from "./server";
import type { ToolContext } from "./tools";

process.env.WALKOFF_OPERATOR_EMAILS = "op@walkoff.io";

const BRAND = "7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10";
const OTHER = "7d1c2f9e-2222-4c8a-9a51-0d6c3b0e8f10";
const NOW = new Date("2026-10-25T12:00:00Z");
const DARNOLD = athleteId("football", "3912547");

const principal = (email: string, brandIds: string[] | null): Principal => ({ email, brandIds, clientId: "claude", scope: "walkoff" });
const member = principal("jane@frostbuddy.com", [BRAND]);
const operator = principal("op@walkoff.io", null);

async function connect(p: Principal, db: ReturnType<typeof fakeDb>) {
  const ctx: ToolContext = { db, principal: p, now: () => NOW, origin: "https://www.walkoff.io" };
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([createWalkoffServer(ctx).connect(serverSide), client.connect(clientSide)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { isError: r.isError === true, text, json: () => JSON.parse(text) };
}

const athlete = (id: string, name: string, team: string | null, over: Row = {}): Row => ({
  id,
  sport: "football",
  league: "nfl",
  external_id: id.split(":")[2],
  display_name: name,
  name_key: name.toLowerCase().replace(/[^a-z]/g, ""),
  team_id: team,
  position: "QB",
  jersey: "14",
  roster_status: "active",
  college: null,
  ...over,
});

/** Frost Buddy, with customers around Orange County and New York, and
 *  three athletes: Sam Darnold (San Clemente), a Brooklyn kid, and one from
 *  nowhere near. */
async function world(options: { through?: string } = {}) {
  const db = fakeDb(
    {
      brands: [
        { id: BRAND, name: "Frost Buddy", store_url: "https://frostbuddy.com", licensed: false, upload_token: "t".repeat(24) },
        { id: OTHER, name: "Sunday Supply", store_url: null, licensed: false, upload_token: "u".repeat(24) },
      ],
      brand_area_counts: [
        { brand_id: BRAND, country: "US", area: "926", customers: 1000, orders: 0, revenue: 0 },
        { brand_id: BRAND, country: "US", area: "112", customers: 400, orders: 0, revenue: 0 },
        { brand_id: OTHER, country: "US", area: "926", customers: 50, orders: 0, revenue: 0 },
      ],
      athletes: [
        athlete(DARNOLD, "Sam Darnold", "espn:nfl:26"),
        athlete("espn:football:4000001", "Brooklyn Kid", "espn:nfl:19", { roster_status: "reserve", position: "WR" }),
        athlete("espn:football:4000002", "Far Away", "espn:nfl:12"),
      ],
    },
    options,
  );
  if (!options.through) {
    const placed = async (id: string, kind: "birthplace" | "high_school" | "hometown", source: "espn" | "wikidata" | "curated", raw: string, town = raw) =>
      athletePlace(id, kind, source, raw, await resolveTown(town));
    await savePlaces(db, [
      await placed(DARNOLD, "birthplace", "espn", "Capistrano Beach, CA, USA", "Capistrano Beach, CA"),
      await placed(DARNOLD, "high_school", "wikidata", "San Clemente High School", "San Clemente, CA"),
      await placed(DARNOLD, "hometown", "curated", "San Clemente, CA"),
      await placed("espn:football:4000001", "birthplace", "espn", "Brooklyn, NY, USA", "Brooklyn, NY"),
      await placed("espn:football:4000002", "birthplace", "espn", "Marfa, TX, USA", "Marfa, TX"),
    ]);
  }
  return db;
}

describe("local_athletes", () => {
  it("lists the towns near the brand's customers and who's from each, names for the marketer only", async () => {
    const db = await world();
    db.tables.brand_athlete_rights = [
      { id: "r1", brand_id: BRAND, athlete_id: DARNOLD, may_name: true, starts_on: "2026-01-01", ends_on: "2026-12-31", evidence: "NIL agreement 2026-014", recorded_by: "op@walkoff.io", revoked_at: null },
    ];
    const client = await connect(member, db);
    const r = await call(client, "local_athletes");
    assert.ok(!r.isError, r.text);
    const out = r.json();
    assert.match(out.copy_rule, /never names or describes an athlete/);
    assert.deepEqual(out.towns.map((t: { town: string }) => t.town), ["Brooklyn, NY", "San Clemente, CA"]);
    const brooklyn = out.towns[0];
    assert.match(brooklyn.big_city, /no hometown moments here/);
    assert.equal(brooklyn.athletes[0].roster, "reserve (injured, practice squad or suspended)");
    const sc = out.towns[1];
    assert.equal(sc.circle, "5 miles around 92673");
    assert.ok(sc.customers_estimate > 50 && sc.customers_estimate < 100, `${sc.customers_estimate}`);
    assert.ok(sc.lift > 1);
    assert.deepEqual(sc.athletes, [
      {
        name: "Sam Darnold",
        id: DARNOLD,
        team: "Seattle Seahawks",
        position: "QB",
        how_walkoff_knows: ["Walkoff's own research"],
        sure: 0.95,
        may_name: "Yes, through 2026-12-31, within the agreement",
      },
    ]);
    assert.equal(out.athletes_found, 2, "Marfa isn't near Frost Buddy's customers");
    assert.match(client.getInstructions()!, /never names or describes an athlete/);
    assert.ok(!client.getInstructions()!.includes("set_athlete_home"));
    await client.close();
  });

  it("works only within the brands the person may use", async () => {
    const client = await connect(member, await world());
    const r = await call(client, "local_athletes", { brand: "Sunday Supply" });
    assert.ok(r.isError);
    assert.doesNotMatch(r.text, /Darnold/);
    await client.close();
  });

  it("says so before there's athlete data, or customer counts", async () => {
    const before = await connect(member, await world({ through: "008" }));
    const r = await call(before, "local_athletes");
    assert.ok(!r.isError, r.text);
    assert.deepEqual(r.json().towns, []);
    assert.match(r.json().note, /009_athletes\.sql/);
    await before.close();

    const db = await world();
    db.tables.brand_area_counts = [];
    const empty = await connect(member, db);
    const e = await call(empty, "local_athletes");
    assert.ok(e.isError);
    assert.match(e.text, /no customer counts yet/);
    await empty.close();
  });
});

describe("set_athlete_home", () => {
  it("sets where an athlete is from over every source, and clears it again", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const set = await call(client, "set_athlete_home", { athlete: "sam darnold", hometown: "Dana Point, CA", note: "Says so in his own words" });
    assert.ok(!set.isError, set.text);
    assert.deepEqual(set.json().homes_before.map((h: { town: string }) => h.town), ["San Clemente, CA"]);
    assert.deepEqual(set.json().homes_now, [{ town: "Dana Point, CA", place_key: "census:0617946", sure: 1, from: ["set by Walkoff"] }]);
    assert.deepEqual(set.json().recent_moments, []);
    const row = db.tables.athlete_places.find((p) => p.source === "operator")!;
    assert.deepEqual([row.updated_by, row.note, row.raw], ["op@walkoff.io", "Says so in his own words", "Dana Point, CA"]);

    const cleared = await call(client, "set_athlete_home", { athlete: DARNOLD, clear: true, note: "Was wrong" });
    assert.ok(!cleared.isError, cleared.text);
    assert.deepEqual(cleared.json().homes_now.map((h: { town: string }) => h.town), ["San Clemente, CA"]);
    assert.equal(db.tables.athlete_places.filter((p) => p.source === "operator").length, 0);
    await client.close();
  });

  it("refuses a town it can't place, and asks which athlete when two share a name", async () => {
    const db = await world();
    db.tables.athletes.push(athlete("espn:football:4000003", "Sam Darnold", null));
    const client = await connect(operator, db);
    const two = await call(client, "set_athlete_home", { athlete: "Sam Darnold", hometown: "Dana Point, CA", note: "x" });
    assert.ok(two.isError);
    assert.match(two.text, /More than one athlete is called Sam Darnold: .*id espn:football:3912547.*id espn:football:4000003/);
    for (const [hometown, said] of [
      ["Springfield, PA", /could be .*Add the state or province, or give a postal code/],
      ["Uppsala, Sweden", /outside the US, Canada and the UK/],
      ["Nowhereville, CA", /can't find Nowhereville, CA/],
    ] as const) {
      const r = await call(client, "set_athlete_home", { athlete: DARNOLD, hometown, note: "x" });
      assert.ok(r.isError, hometown);
      assert.match(r.text, said);
    }
    assert.match((await call(client, "set_athlete_home", { athlete: "Nobody Here", hometown: "Dana Point, CA", note: "x" })).text, /no athlete called Nobody Here/);
    assert.equal(db.tables.athlete_places.filter((p) => p.source === "operator").length, 0);
    await client.close();
  });
});

describe("record_athlete_rights", () => {
  it("records a brand's written rights to name an athlete, with dates and evidence, and revokes them", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const r = await call(client, "record_athlete_rights", {
      brand: "Frost Buddy",
      athlete: DARNOLD,
      starts_on: "2026-01-01",
      ends_on: "2026-12-31",
      evidence: "NIL agreement 2026-014",
    });
    assert.ok(!r.isError, r.text);
    assert.deepEqual(r.json().rights_on_file, [
      { starts_on: "2026-01-01", ends_on: "2026-12-31", evidence: "NIL agreement 2026-014", recorded_by: "op@walkoff.io", status: "in date" },
    ]);
    assert.match(r.json().rule, /may name Sam Darnold while the agreement is in date.*Get the athlete's OK for each use/);

    const revoked = await call(client, "record_athlete_rights", { brand: "Frost Buddy", athlete: DARNOLD, revoke: true });
    assert.equal(revoked.json().revoked, 1);
    assert.equal(revoked.json().rights_on_file[0].status, "revoked");
    assert.match(revoked.json().rule, /never name Sam Darnold/);
    await client.close();
  });

  it("needs dates that make sense and evidence", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const base = { brand: "Frost Buddy", athlete: DARNOLD };
    for (const [args, said] of [
      [{ starts_on: "2026-01-01", ends_on: "2026-12-31" }, /give starts_on, ends_on and evidence/],
      [{ starts_on: "2026-01-01", ends_on: "2026-12-31", evidence: "   " }, /give starts_on, ends_on and evidence/],
      [{ starts_on: "2026-02-30", ends_on: "2026-12-31", evidence: "NIL 1" }, /like 2026-01-01/],
      [{ starts_on: "2026-01-01", ends_on: "2026-13-45", evidence: "NIL 1" }, /like 2026-01-01/],
      [{ starts_on: "2026-12-31", ends_on: "2026-01-01", evidence: "NIL 1" }, /ends_on is before starts_on/],
    ] as const) {
      const r = await call(client, "record_athlete_rights", { ...base, ...args });
      assert.ok(r.isError, JSON.stringify(args));
      assert.match(r.text, said);
    }
    assert.equal((db.tables.brand_athlete_rights ?? []).length, 0);
    assert.ok(client.getInstructions()!.endsWith(OPERATOR_INSTRUCTIONS));
    assert.match(OPERATOR_INSTRUCTIONS, /set_athlete_home fixes it/);
    await client.close();
  });
});

describe("exclude_athlete", () => {
  it("deletes where an athlete is from, never saves it again, and can be taken back", async () => {
    const db = await world();
    db.tables.moments = [
      { id: "m1", type: "hometown_title", headline: "Hometown champion: Sam Darnold · San Clemente, CA", athlete_id: DARNOLD, place_key: "census:0665084", detected_at: "2026-10-24T03:00:00Z" },
    ];
    const op = await connect(operator, db);
    const r = await call(op, "exclude_athlete", { athlete: "Sam Darnold", note: "His agent, by email to hello@walkoff.io" });
    assert.ok(!r.isError, r.text);
    const out = r.json();
    assert.deepEqual([out.excluded, out.since, out.places_deleted], [true, "2026-10-25", 3]);
    assert.deepEqual(out.recent_moments.map((m: { id: string }) => m.id), ["m1"]);
    assert.match(out.next, /retract_moment/);
    const row = db.tables.athletes.find((a) => a.id === DARNOLD)!;
    assert.deepEqual([row.opted_out_at, row.opted_out_note], [NOW.toISOString(), "His agent, by email to hello@walkoff.io"]);
    assert.equal(db.tables.athlete_places.filter((p) => p.athlete_id === DARNOLD).length, 0);

    // Nothing saves a place for him again: not a source, not an operator.
    await savePlaces(db, [athletePlace(DARNOLD, "birthplace", "espn", "Capistrano Beach, CA, USA", await resolveTown("Capistrano Beach, CA"))]);
    assert.equal(db.tables.athlete_places.filter((p) => p.athlete_id === DARNOLD).length, 0);
    for (const [tool, args] of [
      ["set_athlete_home", { athlete: DARNOLD, hometown: "Dana Point, CA", note: "x" }],
      ["create_moment", { athlete: DARNOLD, event: "Charity golf day", date: "2026-10-20", note: "x" }],
    ] as const) {
      const refused = await call(op, tool, args);
      assert.ok(refused.isError, tool);
      assert.match(refused.text, /Sam Darnold asked Walkoff to stop using them, on 2026-10-25/);
    }
    assert.equal(db.tables.athlete_places.filter((p) => p.athlete_id === DARNOLD).length, 0);

    // Members no longer see him near their customers.
    const brand = await connect(member, db);
    const towns = (await call(brand, "local_athletes")).json().towns;
    assert.ok(!JSON.stringify(towns).includes("Darnold"));
    await brand.close();

    const again = (await call(op, "exclude_athlete", { athlete: DARNOLD, note: "Asked again" })).json();
    assert.deepEqual([again.excluded, again.note], [true, "They were excluded already."]);
    assert.equal(db.tables.athletes.find((a) => a.id === DARNOLD)!.opted_out_note, "His agent, by email to hello@walkoff.io");

    const undo = (await call(op, "exclude_athlete", { athlete: DARNOLD, note: "His agent says go ahead", undo: true })).json();
    assert.equal(undo.excluded, false);
    assert.match(undo.next, /learns where they're from again/);
    assert.equal(db.tables.athletes.find((a) => a.id === DARNOLD)!.opted_out_at, null);
    await savePlaces(db, [athletePlace(DARNOLD, "birthplace", "espn", "Capistrano Beach, CA, USA", await resolveTown("Capistrano Beach, CA"))]);
    assert.equal(db.tables.athlete_places.filter((p) => p.athlete_id === DARNOLD).length, 1);
    await op.close();
  });

  it("says so before 011_athlete_opt_outs.sql has run, and everything else still works", async () => {
    const db = await world({ through: "010" });
    await savePlaces(db, [athletePlace(DARNOLD, "hometown", "curated", "San Clemente, CA", await resolveTown("San Clemente, CA"))]);
    assert.equal(db.tables.athlete_places.length, 1, "places save as before");
    const op = await connect(operator, db);
    const r = await call(op, "exclude_athlete", { athlete: DARNOLD, note: "x" });
    assert.ok(r.isError);
    assert.match(r.text, /011_athlete_opt_outs\.sql/);
    assert.ok(!(await call(op, "set_athlete_home", { athlete: DARNOLD, hometown: "Dana Point, CA", note: "x" })).isError);
    await op.close();
  });
});
