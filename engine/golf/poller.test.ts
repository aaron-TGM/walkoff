import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { HometownDetail } from "../../lib/hometown";
import { fakeDb, type Row } from "../../lib/testing/fake-db";
import { tourById } from "../../lib/tours";
import type { GolfBio, GolfFeed } from "./feed";
import { GOLF_POLL, GolfPoller } from "./poller";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));
const PGA = tourById("pga")!;
const RORY = "espn:golf:3470";

/** The birthplaces ESPN's bios give. Anyone else's has none here. */
const BIOS: Record<string, GolfBio> = {
  "3470": { city: "Holywood", state: "", country: "Northern Ireland" },
  "4425906": { city: "Scarborough", state: "New York", country: "USA" },
  "11056": { city: "Loomis", state: "California", country: "USA" },
};

function feedOf(board: unknown, opts: { failBio?: string; failBoard?: boolean } = {}) {
  const bios: string[] = [];
  /** The leaderboard the feed gives now: a test can swap it between polls. */
  const live = { board };
  const feed: GolfFeed = {
    async leaderboard() {
      if (opts.failBoard) throw new Error("feed down");
      return live.board as never;
    },
    async bio(id) {
      bios.push(id);
      if (id === opts.failBio) throw new Error("bio down");
      return BIOS[id] ?? null;
    },
  };
  return { feed, bios, live };
}

function poller(board: unknown, opts: { hometown?: boolean; now: string; through?: string; failBio?: string; failBoard?: boolean }) {
  const db = fakeDb({}, { through: opts.through });
  const { feed, bios, live } = feedOf(board, opts);
  const clock = { now: Date.parse(opts.now) };
  const p = new GolfPoller(PGA, db, feed, { hometown: opts.hometown ?? true, now: () => clock.now });
  return { db, p, bios, clock, live };
}

const moments = (db: { tables: Record<string, Row[]> }) => (db.tables.moments ?? []).filter((m) => String(m.type).startsWith("hometown_"));

describe("GolfPoller", () => {
  it("Masters 2026: records McIlroy's win and makes Holywood's moment, once", async () => {
    const { db, p, bios } = poller(fixture("golf-pga-masters-2026"), { now: "2026-04-12T23:30:00Z" });
    assert.equal(await p.tick(), GOLF_POLL.idle);

    assert.equal(db.tables.athletes.length, 15, "the field");
    assert.equal(db.tables.athletes.find((a) => a.id === RORY)?.sport, "golf");
    assert.equal(bios[0], "3470", "the winner's bio first");
    const place = db.tables.athlete_places.find((x) => x.athlete_id === RORY);
    assert.deepEqual([place?.raw, place?.place_name, place?.region], ["Holywood, Northern Ireland", "Holywood", "NIR"]);

    const [result] = db.tables.athlete_results;
    assert.deepEqual([result.athlete_id, result.kind, result.role, result.intensity, result.event_key], [RORY, "win", "leader", 0.95, "golf:masters-tournament:2026-04-12"]);
    const [m] = moments(db);
    assert.equal(m.type, "hometown_win");
    assert.equal(m.headline, "Hometown win: Rory McIlroy won the Masters Tournament · Holywood, Northern Ireland");
    assert.deepEqual([m.league, m.athlete_id, m.team_id, m.intensity, m.phase], ["pga", RORY, null, 0.95, "season"]);

    await p.tick();
    assert.equal(db.tables.athlete_results.length, 1);
    assert.equal(moments(db).length, 1, "a repeat adds nothing");
    assert.equal(db.tables.engine_heartbeats.find((h) => h.league === "golf:pga")?.games, 1);
  });

  it("after round 3: the leaders' towns, open until they tee off on Sunday", async () => {
    const { db, p } = poller(fixture("golf-pga-masters-2026-after-round-3"), { now: "2026-04-12T01:00:00Z" });
    assert.equal(await p.tick(), GOLF_POLL.live);
    const results = db.tables.athlete_results;
    assert.deepEqual(results.map((r) => r.kind), ["lead", "lead"]);
    assert.ok(results.every((r) => r.intensity === 0.7));
    // Scarborough is a hamlet that isn't a Census place or a postal name:
    // Walkoff doesn't know it, so it makes no moment rather than guess.
    assert.equal(db.tables.athlete_places.find((x) => x.athlete_id === "espn:golf:4425906")?.resolution, "unknown");
    assert.deepEqual(
      moments(db).map((m) => m.headline),
      ["Hometown contender: Rory McIlroy leads the Masters Tournament going into the final round · Holywood, Northern Ireland"],
    );
    const m = moments(db)[0];
    assert.equal(m.phase, "before");
    assert.equal((m.detail as HometownDetail).startsAt, "2026-04-12T18:25Z");
  });

  it("records nothing while the final round is suspended, then Monday's playoff win", async () => {
    const { db, p, clock, live } = poller(fixture("golf-pga-bermuda-suspended"), { now: "2026-10-26T04:00:00Z" });
    assert.equal(await p.tick(), GOLF_POLL.live, "polls fast while it's under way");
    assert.equal(db.tables.athletes.length, 10);
    assert.equal(db.tables.athlete_results?.length ?? 0, 0);
    assert.equal(db.tables.engine_heartbeats[0].live_games, 1);

    live.board = fixture("golf-pga-bermuda-final");
    clock.now = Date.parse("2026-10-26T15:30:00Z");
    assert.equal(await p.tick(), GOLF_POLL.idle);
    const [result] = db.tables.athlete_results;
    assert.deepEqual([result.athlete_id, result.kind, result.intensity, result.event_key], ["espn:golf:11056", "win", 0.85, "golf:butterfield-bermuda-championship:2026-10-26"]);
    assert.deepEqual(moments(db).map((m) => m.headline), ["Hometown win: Austin Smotherman won the Butterfield Bermuda Championship · Loomis, CA"]);
  });

  it("without HOMETOWN, results but no moments", async () => {
    const { db, p } = poller(fixture("golf-pga-masters-2026"), { now: "2026-04-12T23:30:00Z", hometown: false });
    await p.tick();
    assert.equal(db.tables.athlete_results.length, 1);
    assert.deepEqual(moments(db), []);
  });

  it("reads a few of the field's bios each poll, and a bio that fails another time", async () => {
    const { db, p, bios } = poller(fixture("golf-pga-bermuda-suspended"), { now: "2026-10-26T04:00:00Z", failBio: "11056" });
    await p.tick();
    assert.equal(bios.length, GOLF_POLL.biosPerPoll);
    await p.tick();
    assert.equal(bios.length, 2 * GOLF_POLL.biosPerPoll);
    const read = db.tables.athletes.filter((a) => a.bio_checked_at);
    assert.equal(read.length, 2 * GOLF_POLL.biosPerPoll - 2, "the one that failed waits, and was asked twice");
    assert.equal(bios.filter((id) => id === "11056").length, 2);
  });

  it("backs off when the feed fails, and waits for 009_athletes.sql", async () => {
    const down = poller(null, { now: "2026-10-26T04:00:00Z", failBoard: true });
    assert.equal(await down.p.tick(), 60_000);
    assert.equal(await down.p.tick(), 120_000);
    assert.equal(down.db.tables.engine_heartbeats[0].last_error, "feed down");

    const before = poller(fixture("golf-pga-masters-2026"), { now: "2026-04-12T23:30:00Z", through: "008" });
    assert.equal(await before.p.tick(), GOLF_POLL.noTables);
    assert.equal(before.bios.length, 0);
  });
});
