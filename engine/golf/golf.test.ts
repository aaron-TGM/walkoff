import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { tourById } from "../../lib/tours";
import { parseBio } from "./feed";
import { GOLF, isElevated, isMajor, winIntensity } from "./majors";
import { normalizeLeaderboard } from "./normalize";
import { golfEventKey, golfOutcome } from "./outcome";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));
const PGA = tourById("pga")!;
const LPGA = tourById("lpga")!;
const at = (iso: string) => Date.parse(iso);

describe("normalizeLeaderboard", () => {
  it("reads the 2026 Masters final", () => {
    const [e] = normalizeLeaderboard("pga", fixture("golf-pga-masters-2026"));
    assert.deepEqual([e.id, e.name, e.state, e.rounds, e.majorFlag], ["espn:golf:401811941", "Masters Tournament", "final", 4, true]);
    const [rory, scottie] = e.players;
    assert.deepEqual([rory.externalId, rory.name, rory.position, rory.tied, rory.toPar], ["3470", "Rory McIlroy", 1, false, -12]);
    assert.deepEqual(rory.rounds.map((r) => r.strokes), [67, 65, 73, 71]);
    assert.equal(rory.rounds[3].teeTime, "2026-04-12T18:25Z");
    assert.deepEqual([scottie.position, scottie.toPar], [2, -11]);
    assert.equal(e.players.filter((p) => p.position === 3).every((p) => p.tied), true);
  });

  it("reads a final round that's suspended as under way", () => {
    const [e] = normalizeLeaderboard("pga", fixture("golf-pga-bermuda-suspended"));
    assert.deepEqual([e.state, e.statusName, e.roundComplete, e.period, e.rounds], ["in", "STATUS_SUSPENDED", false, 3, 3]);
    // The leaders finished their round, tied: still no winner.
    assert.deepEqual(e.players.filter((p) => p.position === 1).map((p) => p.name), ["Austin Smotherman", "Séamus Power"]);
  });

  it("reads canceled events as off", () => {
    assert.deepEqual(normalizeLeaderboard("liv", fixture("golf-liv-canceled")).map((e) => e.state), ["off", "off"]);
  });
});

describe("majors", () => {
  it("knows the majors by name", () => {
    for (const name of [
      "Masters Tournament",
      "PGA Championship",
      "U.S. Open",
      "The Open",
      "The 154th Open",
      "The Chevron Championship",
      "U.S. Women's Open",
      "KPMG Women's PGA Championship",
      "AIG Women's Open",
      "The Amundi Evian Championship",
    ]) {
      assert.ok(isMajor(name), name);
    }
  });

  it("isn't fooled by an Open or a Championship", () => {
    for (const name of ["Genesis Scottish Open", "Senior PGA Championship", "U.S. Senior Open", "The Senior Open Presented by Rolex", "Korn Ferry Tour Championship", "Genesis Championship", "RBC Canadian Open"]) {
      assert.ok(!isMajor(name), name);
    }
  });

  it("prices a win by the event and the tour", () => {
    assert.equal(winIntensity(PGA, "Masters Tournament"), GOLF.major);
    assert.equal(winIntensity(PGA, "THE PLAYERS Championship"), GOLF.elevated);
    assert.ok(isElevated("the Memorial Tournament presented by Workday"));
    assert.equal(winIntensity(PGA, "Butterfield Bermuda Championship"), 0.8);
    assert.equal(winIntensity(tourById("eur")!, "Genesis Championship"), 0.75);
    assert.equal(winIntensity(tourById("liv")!, "LIV Golf Virginia"), 0.7);
  });
});

describe("golfOutcome", () => {
  it("Masters 2026: McIlroy wins a major", () => {
    const [e] = normalizeLeaderboard("pga", fixture("golf-pga-masters-2026"));
    const o = golfOutcome(e, PGA, at("2026-04-12T23:30:00Z"));
    assert.equal(o?.kind, "win");
    assert.deepEqual(o?.players.map((p) => p.name), ["Rory McIlroy"]);
    assert.equal(o?.intensity, 0.95);
    assert.equal(o?.eventKey, "golf:masters-tournament:2026-04-12");
    assert.equal(golfOutcome(e, PGA, at("2026-04-15T00:00:00Z")), null, "60 hours after the last day starts, it's done");
  });

  it("after round 3: the leaders, tied, once Sunday's tee times are out, and no winner", () => {
    const [e] = normalizeLeaderboard("pga", fixture("golf-pga-masters-2026-after-round-3"));
    assert.equal(e.roundComplete, true, "the feed calls round 3 complete");
    const o = golfOutcome(e, PGA, at("2026-04-12T01:00:00Z"));
    assert.equal(o?.kind, "lead");
    assert.deepEqual(o?.players.map((p) => p.name), ["Rory McIlroy", "Cameron Young"]);
    assert.equal(o?.intensity, GOLF.contenderMajor);
    assert.equal(o?.startsAt, "2026-04-12T18:25Z");
    assert.equal(o?.eventKey, golfEventKey(e), "the same event as the win");
    assert.equal(golfOutcome(e, PGA, at("2026-04-12T18:30:00Z")), null, "once they've teed off");
    assert.equal(golfOutcome({ ...e, name: "Butterfield Bermuda Championship" }, PGA, at("2026-04-12T01:00:00Z"))?.intensity, GOLF.contender);
  });

  it("no winner while the final round is suspended, even with the leaders done", () => {
    const [e] = normalizeLeaderboard("pga", fixture("golf-pga-bermuda-suspended"));
    assert.equal(golfOutcome(e, PGA, at("2026-10-26T04:00:00Z")), null);
  });

  it("LPGA: a win counts for a tour event", () => {
    const [e] = normalizeLeaderboard("lpga", fixture("golf-lpga-bmw-ladies-final"));
    const o = golfOutcome(e, LPGA, at("2026-10-26T04:00:00Z"));
    assert.deepEqual([o?.kind, o?.players[0].name, o?.intensity], ["win", "Yuri Yoshida", 0.8]);
  });

  it("adds a little for a playoff win, and none for a tie at the top", () => {
    const [e] = normalizeLeaderboard("pga", fixture("golf-pga-masters-2026"));
    const playoff = { ...e, players: e.players.map((p, i) => (i < 2 ? { ...p, playoff: true } : p)) };
    assert.equal(golfOutcome(playoff, PGA, at("2026-04-12T23:30:00Z"))?.intensity, 1);
    const tied = { ...e, players: e.players.map((p, i) => (i < 2 ? { ...p, position: 1, tied: true } : p)) };
    assert.equal(golfOutcome(tied, PGA, at("2026-04-12T23:30:00Z")), null);
  });
});

describe("parseBio", () => {
  it("reads a golfer's birthplace and trims the padded state", () => {
    assert.deepEqual(parseBio({ athlete: { birthPlace: { city: "Northbrook", state: "Illinois                 ", country: "USA" } } }), {
      city: "Northbrook",
      state: "Illinois",
      country: "USA",
    });
    assert.deepEqual(parseBio({ athlete: { birthPlace: { city: "Holywood", country: "Northern Ireland" } } }), { city: "Holywood", state: "", country: "Northern Ireland" });
    assert.equal(parseBio({ athlete: {} }), null);
  });
});
