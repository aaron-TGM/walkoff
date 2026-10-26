import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { HometownDetail } from "../../lib/hometown";
import { fakeDb, type Row } from "../../lib/testing/fake-db";
import { tourById } from "../../lib/tours";
import { CIRCUIT_POLL, type Bio } from "../circuits/poller";
import type { EspnTennisScoreboard, TennisFeed } from "./feed";
import { normalizeTennis } from "./normalize";
import { TENNIS, tennisOutcomes, tennisTier } from "./outcome";
import { TennisPoller } from "./poller";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8")) as EspnTennisScoreboard;
const ATP = tourById("atp")!;
const WTA = tourById("wta")!;
const at = (iso: string) => Date.parse(iso);

/** The same draw the day before its final: both finalists known, the
 *  final scheduled. ESPN keeps only how a past draw ended, so the tests
 *  turn the real final back. */
function beforeFinal(board: EspnTennisScoreboard): EspnTennisScoreboard {
  const b = structuredClone(board);
  for (const g of b.events![0].groupings!) {
    for (const m of g.competitions ?? []) {
      if (m.round?.displayName !== "Final") continue;
      m.status = { type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } };
      for (const c of m.competitors ?? []) delete c.winner;
    }
  }
  return b;
}

describe("normalizeTennis", () => {
  it("each tour takes its own singles draw from a Slam both feeds carry", () => {
    const board = fixture("tennis-atp-us-open-2026");
    const [men] = normalizeTennis("atp", board);
    const [women] = normalizeTennis("wta", board);
    assert.deepEqual([men.name, men.major, men.state], ["US Open", true, "final"]);
    assert.deepEqual([men.final?.players.map((p) => p.name), men.final?.winner?.name], [["Ben Shelton", "Alexander Zverev"], "Alexander Zverev"]);
    assert.equal(women.final?.winner?.name, "Elena Rybakina");
    assert.ok(!men.players.some((p) => p.name === "Elena Rybakina"), "the men's field only");
  });

  it("before the final: under way, the finalists known, no winner", () => {
    const [e] = normalizeTennis("wta", beforeFinal(fixture("tennis-wta-kia-open-2026")));
    assert.deepEqual([e.state, e.final?.state, e.final?.winner], ["in", "pre", null]);
    assert.deepEqual(e.final?.players.map((p) => p.name), ["Anna Blinkova", "Claire Liu"]);
  });

  it("leaves out a final whose players aren't known yet", () => {
    const board = beforeFinal(fixture("tennis-wta-kia-open-2026"));
    for (const c of board.events![0].groupings![0].competitions!.find((m) => m.round?.displayName === "Final")!.competitors!) {
      delete c.id;
      c.athlete = { displayName: "TBD" };
    }
    const [e] = normalizeTennis("wta", board);
    assert.deepEqual(e.final?.players, []);
    assert.deepEqual(tennisOutcomes(e, WTA, at("2026-09-12T12:00:00Z")), []);
  });
});

describe("tennisTier", () => {
  it("Slams by the feed's flag or by name, then each tour's Finals and 1000s", () => {
    assert.equal(tennisTier("atp", { name: "Wimbledon", major: false }), "slam");
    assert.equal(tennisTier("atp", { name: "Nitto ATP Finals", major: false }), "finals");
    assert.equal(tennisTier("atp", { name: "Rolex Paris Masters", major: false }), "thousand");
    // Beijing is a 1000 for the WTA, a 500 for the ATP.
    assert.equal(tennisTier("wta", { name: "China Open", major: false }), "thousand");
    assert.equal(tennisTier("atp", { name: "China Open", major: false }), "tour");
    assert.equal(tennisTier("wta", { name: "Kia Open", major: false }), "tour");
  });
});

describe("tennisOutcomes", () => {
  it("US Open 2026: Zverev wins a Slam; Rybakina's is the WTA's", () => {
    const board = fixture("tennis-atp-us-open-2026");
    const [men] = normalizeTennis("atp", board);
    const [o] = tennisOutcomes(men, ATP, at("2026-09-13T23:00:00Z"));
    assert.deepEqual([o.kind, o.players.map((p) => p.name), o.intensity, o.eventKey], ["win", ["Alexander Zverev"], TENNIS.slam, "tennis:atp:us-open:2026"]);
    const [women] = normalizeTennis("wta", board);
    assert.equal(tennisOutcomes(women, WTA, at("2026-09-13T00:00:00Z"))[0].eventKey, "tennis:wta:us-open:2026", "a different event");
    assert.deepEqual(tennisOutcomes(men, ATP, at("2026-09-16T08:00:00Z")), [], "60 hours on, it's done");
  });

  it("before a Slam final, both finalists are contenders until it starts", () => {
    const [men] = normalizeTennis("atp", beforeFinal(fixture("tennis-atp-us-open-2026")));
    const [o] = tennisOutcomes(men, ATP, at("2026-09-13T08:00:00Z"));
    assert.deepEqual([o.kind, o.players.map((p) => p.name), o.intensity, o.startsAt], ["lead", ["Ben Shelton", "Alexander Zverev"], TENNIS.finalistSlam, "2026-09-13T18:15Z"]);
    assert.deepEqual(tennisOutcomes(men, ATP, at("2026-09-13T18:20:00Z")), [], "once it's started");
  });

  it("a tour event's win counts by the tour, its finalists under the default trigger", () => {
    const [e] = normalizeTennis("wta", fixture("tennis-wta-kia-open-2026"));
    assert.equal(tennisOutcomes(e, WTA, at("2026-09-13T01:00:00Z"))[0].intensity, WTA.winIntensity);
    const [pre] = normalizeTennis("wta", beforeFinal(fixture("tennis-wta-kia-open-2026")));
    assert.equal(tennisOutcomes(pre, WTA, at("2026-09-12T12:00:00Z"))[0].intensity, TENNIS.finalist);
  });
});

describe("TennisPoller", () => {
  const BIOS: Record<string, Bio> = { "2980": { city: "Thousand Oaks, CA, USA", state: "", country: "" } };
  const feedOf = (board: EspnTennisScoreboard): TennisFeed => ({ scoreboard: async () => board, bio: async (_tour, id) => BIOS[id] ?? null });
  const moments = (db: { tables: Record<string, Row[]> }) => (db.tables.moments ?? []).filter((m) => String(m.type).startsWith("hometown_"));

  it("Kia Open 2026: Claire Liu's town is watching the final, then celebrates the win", async () => {
    const db = fakeDb({});
    const clock = { now: at("2026-09-12T15:00:00Z") };
    const p = new TennisPoller(WTA, db, feedOf(beforeFinal(fixture("tennis-wta-kia-open-2026"))), { hometown: true, now: () => clock.now });
    assert.equal(await p.tick(), CIRCUIT_POLL.live);
    const [lead] = moments(db);
    assert.equal(lead.headline, "Hometown contender: Claire Liu plays in the final of the Kia Open · Thousand Oaks, CA");
    assert.deepEqual([lead.type, lead.phase, lead.intensity], ["hometown_contender", "before", TENNIS.finalist]);
    assert.equal((lead.detail as HometownDetail).startsAt, "2026-09-12T21:35Z");

    const won = new TennisPoller(WTA, db, feedOf(fixture("tennis-wta-kia-open-2026")), { hometown: true, now: () => at("2026-09-13T01:00:00Z") });
    assert.equal(await won.tick(), CIRCUIT_POLL.idle);
    const win = moments(db).find((m) => m.type === "hometown_win");
    assert.equal(win?.headline, "Hometown win: Claire Liu won the Kia Open · Thousand Oaks, CA");
    assert.equal(db.tables.athletes.find((a) => a.id === "espn:tennis:2980")?.league, "wta");
    assert.equal(db.tables.engine_heartbeats[0].league, "tennis:wta");
  });
});
