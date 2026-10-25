import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { recomputeReport } from "../affinity/store";
import { ACADEMIES, athleteId, athletePlace, momentHomes, placesOf, savePlaces, type Athlete, type AthleteResult } from "../athletes";
import { deriveHometownMoments, ROLE_INTENSITY, saveHometownMoments, type Town } from "../hometown";
import { placeByKey, placeLabel, resolveTown, townCircle } from "../places";
import { fakeDb, type Row } from "../testing/fake-db";
import { assertNeverNames, assertNeverNamesAthlete } from "../testing/names";
import type { Principal } from "./data";
import { createWalkoffServer } from "./server";
import { teamByKey } from "./teams";
import type { ToolContext } from "./tools";

process.env.WALKOFF_OPERATOR_EMAILS = "op@walkoff.io";
delete process.env.WALKOFF_HOMETOWN;
afterEach(() => {
  delete process.env.WALKOFF_HOMETOWN;
});

const FROST = "7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10";
const SOUND = "7d1c2f9e-3333-4c8a-9a51-0d6c3b0e8f10";
const NOW = new Date("2026-02-09T15:00:00Z");
const FINAL = "2026-02-09T03:10:00.000Z";
const GAME = "espn:nfl:401772988";
const SEA = "espn:nfl:26";
const DARNOLD = athleteId("football", "3912547");
const SAN_CLEMENTE = "census:0665084";
const SEAHAWKS = teamByKey("nfl:26")!;

const principal = (email: string, brandIds: string[] | null): Principal => ({ email, brandIds, clientId: "claude", scope: "walkoff" });
const frostMember = principal("jane@frostbuddy.com", [FROST]);
const soundMember = principal("sam@soundsupply.com", [SOUND]);
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

const player = (id: string, name: string, position: string, jersey: string): Athlete => ({
  id,
  sport: "football",
  league: "nfl",
  externalId: id.split(":")[2],
  displayName: name,
  teamId: SEA,
  position,
  jersey,
  rosterStatus: "active",
  college: null,
});

/** Seattle's players in the test: Darnold from San Clemente, one from
 *  Everett (in the Seahawks' own territory), and seven more from towns
 *  around Orange County: four within 10 miles of Dana Point (it too), and
 *  three farther. */
const PLAYERS: { a: Athlete; born: string; role: AthleteResult["role"] }[] = [
  { a: player(DARNOLD, "Sam Darnold", "QB", "14"), born: "", role: "leader" },
  { a: player("espn:football:5000001", "Ever Ett", "WR", "11"), born: "Everett, WA", role: "played" },
  ...["Mission Viejo", "Laguna Niguel", "Dana Point", "Laguna Hills", "Tustin", "Lake Forest", "Costa Mesa"].map((town, i) => ({
    a: player(`espn:football:500001${i}`, `Player ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)}`, "LB", String(50 + i)),
    born: `${town}, CA`,
    role: "roster" as const,
  })),
];

/** The morning after Super Bowl LX: the title saved, its hometown moments
 *  made, Frost Buddy with customers around Orange County and New York,
 *  and Sound Supply with customers around Seattle. */
async function world(options: { through?: string } = {}) {
  const db = fakeDb(
    {
      brands: [
        { id: FROST, name: "Frost Buddy", store_url: "https://frostbuddy.com", licensed: false, upload_token: "f".repeat(24) },
        { id: SOUND, name: "Sound Supply", store_url: "https://soundsupply.com", licensed: false, upload_token: "s".repeat(24) },
      ],
      brand_area_counts: [
        { brand_id: FROST, country: "US", area: "926", customers: 1000, orders: 0, revenue: 0 },
        { brand_id: FROST, country: "US", area: "112", customers: 400, orders: 0, revenue: 0 },
        { brand_id: SOUND, country: "US", area: "981", customers: 2000, orders: 0, revenue: 0 },
        { brand_id: SOUND, country: "US", area: "982", customers: 900, orders: 0, revenue: 0 },
        { brand_id: SOUND, country: "US", area: "980", customers: 600, orders: 0, revenue: 0 },
      ],
      brand_products: [
        { brand_id: FROST, handle: "pier-hoodie", title: "San Clemente Pier Hoodie", teams: [], colors: [], uses: [], interests: [], colorways: [{ name: "Navy", skus: ["PH-N"], image: "" }], price: 78 },
        { brand_id: FROST, handle: "trail-jacket", title: "Trail Jacket", teams: [], colors: [], uses: [], interests: [], colorways: [{ name: "Lime", skus: ["TJ-L"], image: "" }], price: 128 },
        { brand_id: FROST, handle: "board-short", title: "Board Short", teams: [], colors: [], uses: [], interests: ["surf"], colorways: [{ name: "Sand", skus: ["BS-S"], image: "" }], price: 58 },
      ],
      teams: [
        { id: SEA, league: "nfl", external_id: "26", display_name: "Seattle Seahawks" },
        { id: "espn:nfl:17", league: "nfl", external_id: "17", display_name: "New England Patriots" },
      ],
      moments: [
        {
          id: "8c1f2d3e-0000-4000-8000-0000000000aa",
          dedupe_key: `title_won:${GAME}:${SEA}`,
          type: "title_won",
          category: "sports",
          phase: "season",
          league: "nfl",
          game_id: GAME,
          team_id: SEA,
          opponent_team_id: "espn:nfl:17",
          headline: "Champions: Seahawks win the Super Bowl",
          intensity: 1,
          detail: { round: "Super Bowl LX" },
          occurred_at: FINAL,
          detected_at: FINAL,
        },
      ],
      athletes: PLAYERS.map(({ a }) => ({ id: a.id, sport: a.sport, league: a.league, external_id: a.externalId, display_name: a.displayName, name_key: a.displayName.toLowerCase().replace(/[^a-z]/g, ""), team_id: a.teamId, position: a.position, jersey: a.jersey, roster_status: "active", college: null })),
    },
    options,
  );
  for (const b of [FROST, SOUND]) await recomputeReport(db, { id: b, name: b === FROST ? "Frost Buddy" : "Sound Supply" });
  if (options.through) return db;

  await savePlaces(db, [athletePlace(DARNOLD, "hometown", "curated", "San Clemente, CA", await resolveTown("San Clemente, CA"))]);
  for (const { a, born } of PLAYERS.slice(1)) {
    await savePlaces(db, [athletePlace(a.id, "birthplace", "espn", `${born}, USA`, await resolveTown(born))]);
  }
  const places = await placesOf(db, PLAYERS.map((p) => p.a.id));
  const locals = PLAYERS.map(({ a, role }) => ({
    athlete: a,
    result: { athleteId: a.id, eventKey: GAME, eventName: "Super Bowl LX", kind: "title", role, teamId: SEA, momentId: null, intensity: ROLE_INTENSITY[role], occurredAt: FINAL, createdBy: "engine" } as AthleteResult,
    homes: momentHomes(places.filter((p) => p.athleteId === a.id), ACADEMIES),
    led: role === "leader" ? ["Passing Yards"] : undefined,
  }));
  const towns = new Map<string, Town>();
  for (const key of new Set(locals.flatMap((l) => l.homes.map((h) => h.placeKey)))) {
    const place = (await placeByKey(key))!;
    towns.set(key, { place, label: placeLabel(place), circle: await townCircle(place) });
  }
  const moments = deriveHometownMoments(
    { key: GAME, name: "Super Bowl LX", kind: "title", league: "nfl", gameId: GAME, teamId: SEA, teamName: "Seattle Seahawks", opponentTeamId: "espn:nfl:17", occurredAt: FINAL },
    locals,
    towns,
  );
  await saveHometownMoments(db, moments);
  for (const m of db.tables.moments) m.detected_at ??= FINAL;
  return db;
}

/** Everything a shopper sees. */
const seen = (c: { subject_lines: string[]; preview_text: string; headline: string; body: string; html: string }) =>
  [...c.subject_lines, c.preview_text, c.headline, c.body, c.html].join("\n");

const idOf = (db: { tables: Record<string, Row[]> }, placeKey: string) => db.tables.moments.find((m) => m.place_key === placeKey)!.id as string;
type Item = { id: string; type: string; town?: string; customers_estimate?: number; athletes?: { name: string; part: string }[]; copy_rule?: string };
const hometownItems = (queue: Item[]) => queue.filter((x) => x.type.startsWith("hometown_"));

describe("hometown moments before launch", () => {
  it("stay out of members' tools", async () => {
    const db = await world();
    const client = await connect(frostMember, db);
    const q = await call(client, "trigger_queue");
    assert.ok(!q.isError, q.text);
    assert.deepEqual(hometownItems(q.json().queue), []);
    const built = await call(client, "build_campaign", { moment_id: idOf(db, SAN_CLEMENTE) });
    assert.ok(built.isError);
    assert.match(built.text, /No moment with that id/);
    const tools = new Map((await client.listTools()).tools.map((t) => [t.name, Object.keys(t.inputSchema.properties ?? {})]));
    assert.ok(!tools.get("recent_moments")!.includes("scope"));
    assert.ok(!tools.get("create_trigger")!.includes("towns"));
    assert.ok(!tools.get("build_campaign")!.includes("town"));
    assert.ok(!JSON.stringify((await client.listTools()).tools).includes("hometown_"), "no hometown types in the schemas");
    await client.close();
  });

  it("are in operators' queues, to test", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const q = await call(client, "trigger_queue", { brand: "Frost Buddy" });
    assert.ok(!q.isError, q.text);
    const sc = hometownItems(q.json().queue).find((x) => x.town === "San Clemente, CA");
    assert.ok(sc, "San Clemente");
    assert.ok(sc.customers_estimate! >= 50, `${sc.customers_estimate}`);
    assert.deepEqual(sc.athletes![0], { name: "Sam Darnold", id: DARNOLD, position: "QB", part: "led the team (Passing Yards)", how_walkoff_knows: ["Walkoff's own research"], sure: 0.95 });
    assert.match(sc.copy_rule!, /never names or describes an athlete/);
    await client.close();
  });
});

describe("hometown moments after launch", () => {
  it("reach brands with customers near the town, and not through the team", async () => {
    process.env.WALKOFF_HOMETOWN = "1";
    const db = await world();
    const frost = await connect(frostMember, db);
    const fq = (await call(frost, "trigger_queue")).json();
    const towns = hometownItems(fq.queue).map((x) => x.town);
    assert.ok(towns.includes("San Clemente, CA"), towns.join("; "));
    assert.ok(!towns.includes("Everett, WA"), "Frost Buddy has no customers there");
    await frost.close();

    // Sound Supply's standout team is Seattle: it gets the title, not San
    // Clemente's moment, and not Everett's, which the title already reaches.
    const sound = await connect(soundMember, db);
    const sq = (await call(sound, "trigger_queue")).json();
    assert.ok(sq.queue.some((x: Item) => x.type === "title_won"), "the team's title");
    assert.deepEqual(hometownItems(sq.queue), []);
    assert.match(sq.left_out, /^1 hometown moment in the champion's own territory/);
    await sound.close();
  });

  it("shows five towns an event, whoever did the most first, and names the rest", async () => {
    process.env.WALKOFF_HOMETOWN = "1";
    const client = await connect(frostMember, await world());
    const q = (await call(client, "trigger_queue")).json();
    const items = hometownItems(q.queue);
    assert.equal(items.length, 5);
    assert.equal(items[0].town, "San Clemente, CA", "the town of the player who led the team");
    const counts = items.slice(1).map((x) => x.customers_estimate!);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a), "then the most customers");
    assert.equal(q.also_from_these_events.length, 1);
    assert.equal(q.also_from_these_events[0].event, "Super Bowl LX");
    // Tustin is in the next area over, where Frost Buddy has no customers.
    assert.deepEqual(q.also_from_these_events[0].towns.sort(), ["Costa Mesa, CA", "Lake Forest, CA"]);
    await client.close();
  });

  it("follows a trigger for towns, and a trigger for towns takes no team moments", async () => {
    process.env.WALKOFF_HOMETOWN = "1";
    const db = await world();
    const client = await connect(frostMember, db);
    const made = await call(client, "create_trigger", { name: "Near Dana Point", towns: ["Dana Point, CA"] });
    assert.ok(!made.isError, made.text);
    assert.deepEqual(made.json().trigger.towns, ["Dana Point, CA"]);
    assert.deepEqual([made.json().trigger.moments, made.json().trigger.teams], [["any hometown moment"], ["any team"]]);
    const q = (await call(client, "trigger_queue")).json();
    const towns = hometownItems(q.queue).map((x) => x.town).sort();
    // Within 10 miles of Dana Point: Mission Viejo is 9.5 miles off, Lake
    // Forest 12.4.
    assert.deepEqual(towns, ["Dana Point, CA", "Laguna Hills, CA", "Laguna Niguel, CA", "Mission Viejo, CA", "San Clemente, CA"]);
    assert.ok(!q.queue.some((x: Item) => !x.type.startsWith("hometown_")), "no team moments");

    const strict = await call(client, "create_trigger", { name: "Big towns only", moment_types: ["hometown_title"], min_local_customers: 100_000 });
    assert.equal(strict.json().trigger.min_local_customers, 100_000);
    db.tables.triggers = db.tables.triggers.filter((t) => t.name === "Big towns only");
    assert.deepEqual(hometownItems((await call(client, "trigger_queue")).json().queue), []);

    const nowhere = await call(client, "create_trigger", { name: "x", towns: ["Springfield"] });
    assert.ok(nowhere.isError);
    assert.match(nowhere.text, /could be/);
    await client.close();
  });

  it("recent_moments shows towns, even for a brand with no standout team", async () => {
    process.env.WALKOFF_HOMETOWN = "1";
    const db = await world();
    db.tables.affinity_reports = db.tables.affinity_reports.filter((r) => r.brand_id !== FROST);
    const client = await connect(frostMember, db);
    const r = await call(client, "recent_moments");
    assert.ok(!r.isError, r.text);
    assert.deepEqual(r.json().moments, []);
    assert.match(r.json().teams_note, /no fan map yet/);
    assert.ok(r.json().hometown_moments.some((m: Item) => m.town === "San Clemente, CA"));
    const teams = await call(client, "recent_moments", { scope: "teams" });
    assert.ok(teams.isError, "teams only still needs a team");
    await client.close();
  });
});

describe("a hometown campaign", () => {
  it("celebrates the town and never the athlete, the team or the event", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const r = await call(client, "build_campaign", { brand: "Frost Buddy", moment_id: idOf(db, SAN_CLEMENTE), offer: "15% off with code PIER15" });
    assert.ok(!r.isError, r.text);
    const c = r.json();
    assert.equal(c.campaign_name, "Walkoff · San Clemente, CA · Hometown Champion · Feb 8");
    assert.equal(c.audience.segment_name, "Walkoff · San Clemente, CA (5 mi)");
    assert.deepEqual(c.audience.circles, [{ postal_code: "92673", country: "US", radius_miles: 5, center_area: "around 92673" }]);
    assert.deepEqual(c.audience.klaviyo_segment.definition.condition_groups[0].conditions[0], {
      type: "profile-postal-code-distance",
      country_code: "USA",
      postal_code: "92673",
      unit: "miles",
      filter: { type: "numeric", operator: "less-than", value: 5 },
    });
    assert.ok(c.audience.customers.in_circle >= 50);
    assert.equal(c.subject_lines[0], "San Clemente, what a night.");
    assert.equal(c.products[0].title, "San Clemente Pier Hoodie", "named for the town first");
    assert.ok(c.products.some((p: { title: string }) => p.title === "Trail Jacket"), "then the champion's colors");
    assert.match(c.copy_rules[0], /Celebrate the town, never the athlete/);
    assert.ok(seen(c).includes("San Clemente"));
    assert.ok(seen(c).includes("15% off with code PIER15"));
    assertNeverNamesAthlete(seen(c), { name: "Sam Darnold", jersey: "14", position: "QB" });
    assertNeverNames(seen(c), SEAHAWKS);
    assert.match(c.send.why, /morning after|Right away/);
    await client.close();
  });

  it("names the athlete only with written rights in date", async () => {
    const db = await world();
    const rights = (starts: string, ends: string): Row => ({
      id: "r1",
      brand_id: FROST,
      athlete_id: DARNOLD,
      may_name: true,
      starts_on: starts,
      ends_on: ends,
      evidence: "NIL agreement 2026-014",
      recorded_by: "op@walkoff.io",
      revoked_at: null,
    });
    const client = await connect(operator, db);
    db.tables.brand_athlete_rights = [rights("2026-01-01", "2026-12-31")];
    const named = (await call(client, "build_campaign", { brand: "Frost Buddy", moment_id: idOf(db, SAN_CLEMENTE) })).json();
    assert.equal(named.subject_lines[0], "Sam Darnold did it. San Clemente, what a night.");
    assert.match(named.copy_rules[0], /Sam Darnold agreed in writing/);
    assert.ok(named.warnings.some((w: string) => /Get their OK for this use/.test(w)));
    assertNeverNames(seen(named), SEAHAWKS);

    db.tables.brand_athlete_rights = [rights("2025-01-01", "2025-12-31")];
    const expired = (await call(client, "build_campaign", { brand: "Frost Buddy", moment_id: idOf(db, SAN_CLEMENTE) })).json();
    assertNeverNamesAthlete(seen(expired), { name: "Sam Darnold", jersey: "14", position: "QB" });
    await client.close();
  });

  it("builds a sample for a town before there's a moment", async () => {
    const client = await connect(operator, await world());
    const r = await call(client, "build_campaign", { brand: "Frost Buddy", moment_type: "hometown_title", town: "San Clemente, CA", team: "Seahawks" });
    assert.ok(!r.isError, r.text);
    assert.equal(r.json().moment.id, null);
    assert.match(r.json().warnings[0], /This is a sample/);
    const none = await call(client, "build_campaign", { brand: "Frost Buddy", moment_type: "hometown_title" });
    assert.match(none.text, /needs a town/);
    await client.close();
  });
});

describe("retract_moment and create_moment", () => {
  it("retract_moment takes a moment out of every queue, and build_campaign refuses it", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const id = idOf(db, SAN_CLEMENTE);
    await call(client, "log_send", { brand: "Frost Buddy", moment_id: id, status: "drafted" });
    const r = await call(client, "retract_moment", { moment_id: id, reason: "Wrong town" });
    assert.ok(!r.isError, r.text);
    assert.deepEqual(r.json().brands_that_acted.map((b: { brand: string }) => b.brand), ["Frost Buddy"]);
    const q = (await call(client, "trigger_queue", { brand: "Sound Supply" })).json();
    assert.ok(!q.queue.some((x: Item) => x.id === id));
    const built = await call(client, "build_campaign", { brand: "Frost Buddy", moment_id: id });
    assert.ok(built.isError);
    assert.match(built.text, /took that moment back: Wrong town/);
    await client.close();
  });

  it("create_moment adds someone new and makes their town's moment, once", async () => {
    const db = await world();
    const client = await connect(operator, db);
    const args = { athlete: "Griffin Colapinto", event: "WSL Finals", date: "2026-02-08", note: "worldsurfleague.com", sport: "surfing", hometown: "San Clemente, CA" };
    const r = await call(client, "create_moment", args);
    assert.ok(!r.isError, r.text);
    assert.deepEqual(r.json().towns, [{ town: "San Clemente, CA", headline: "Hometown win: Griffin Colapinto won the WSL Finals · San Clemente, CA", new: true, big_city: false }]);
    assert.equal(db.tables.athletes.find((a) => a.id === "walkoff:surfing:griffin-colapinto")?.display_name, "Griffin Colapinto");

    const again = await call(client, "create_moment", { ...args, hometown: undefined });
    assert.equal(again.json().towns[0].new, false);
    const q = (await call(client, "trigger_queue", { brand: "Frost Buddy" })).json();
    const win = q.queue.find((x: Item) => x.type === "hometown_win");
    assert.ok(win, "in the queue");
    const built = (await call(client, "build_campaign", { brand: "Frost Buddy", moment_id: win.id })).json();
    assert.equal(built.products[0].title, "San Clemente Pier Hoodie");
    assert.ok(built.products.some((p: { title: string }) => p.title === "Board Short"), "a surfer's win features surf gear");
    assertNeverNamesAthlete(seen(built), { name: "Griffin Colapinto" });

    for (const [bad, said] of [
      [{ ...args, athlete: "Nobody New", sport: undefined }, /give their sport and hometown/],
      [{ ...args, athlete: "Sam Darnold" }, /knows Sam Darnold already/],
      [{ ...args, date: "2026-02-30" }, /like 2026-09-10/],
      [{ ...args, date: "2026-03-01" }, /hasn't happened yet/],
    ] as const) {
      const e = await call(client, "create_moment", bad);
      assert.ok(e.isError, JSON.stringify(bad));
      assert.match(e.text, said);
    }
    await client.close();
  });

  it("everything still works before 009_athletes.sql has run", async () => {
    const db = await world({ through: "008" });
    const client = await connect(operator, db);
    const q = await call(client, "trigger_queue", { brand: "Sound Supply" });
    assert.ok(!q.isError, q.text);
    assert.ok(q.json().queue.some((x: Item) => x.type === "title_won"));
    for (const [name, args] of [
      ["recent_moments", { brand: "Sound Supply" }],
      ["list_triggers", { brand: "Frost Buddy" }],
      ["create_trigger", { brand: "Frost Buddy", name: "Wins", moment_types: ["walkoff_win"] }],
    ] as const) {
      const r = await call(client, name, args);
      assert.ok(!r.isError, `${name}: ${r.text}`);
    }
    for (const [name, args, said] of [
      ["create_trigger", { brand: "Frost Buddy", name: "Towns", towns: ["San Clemente, CA"] }, /isn't set up yet/],
      ["retract_moment", { moment_id: "8c1f2d3e-0000-4000-8000-0000000000aa", reason: "x" }, /009_athletes\.sql/],
      ["create_moment", { athlete: "Sam Darnold", event: "WSL Finals", date: "2026-02-08", note: "x" }, /009_athletes\.sql/],
    ] as const) {
      const r = await call(client, name, args);
      assert.ok(r.isError, name);
      assert.match(r.text, said);
    }
    await client.close();
  });
});
