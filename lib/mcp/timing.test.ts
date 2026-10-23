import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatLocal, localTime, sendTiming, teamTimeZone, zonedTime } from "./timing";

const LA = "America/Los_Angeles";
const NY = "America/New_York";

describe("teamTimeZone", () => {
  it("uses the team's state, province or country", () => {
    assert.equal(teamTimeZone({ country: "US", region: "CA" }), LA);
    assert.equal(teamTimeZone({ country: "US", region: "AZ" }), "America/Phoenix");
    assert.equal(teamTimeZone({ country: "CA", region: "ON" }), "America/Toronto");
    assert.equal(teamTimeZone({ country: "GB", region: "ENG" }), "Europe/London");
  });
});

describe("zonedTime", () => {
  it("finds the instant of a wall-clock time, across daylight saving", () => {
    assert.equal(zonedTime(2026, 10, 18, 8, 0, LA).toISOString(), "2026-10-18T15:00:00.000Z");
    assert.equal(zonedTime(2026, 12, 6, 8, 0, LA).toISOString(), "2026-12-06T16:00:00.000Z");
    assert.equal(zonedTime(2026, 10, 19, 8, 0, "Europe/London").toISOString(), "2026-10-19T07:00:00.000Z");
    // A day past the end of the month rolls over.
    assert.equal(zonedTime(2026, 10, 32, 8, 0, NY).toISOString(), "2026-11-01T13:00:00.000Z");
  });
});

describe("sendTiming", () => {
  it("sends right away after a result at a decent hour", () => {
    const end = new Date("2026-10-18T23:41:00Z"); // 4:41 PM in LA
    const t = sendTiming({ phase: "after", occurredAt: end, tz: LA, now: new Date("2026-10-18T23:50:00Z") });
    assert.equal(t.send_at_utc, "2026-10-18T23:50:00.000Z");
    assert.equal(t.send_at_local, "Sun 4:50 PM PDT");
  });

  it("waits for 8 AM when it ended late where the fans live", () => {
    const end = new Date("2026-10-19T03:35:00Z"); // 11:35 PM in New York
    const t = sendTiming({ phase: "after", occurredAt: end, tz: NY, now: end });
    assert.equal(t.send_at_utc, "2026-10-19T12:00:00.000Z");
    assert.match(t.why, /morning after/);
  });

  it("an early-morning result waits for 8 AM the same day", () => {
    const end = new Date("2026-10-19T09:00:00Z"); // 5 AM in New York
    const t = sendTiming({ phase: "after", occurredAt: end, tz: NY, now: end });
    assert.equal(t.send_at_utc, "2026-10-19T12:00:00.000Z");
  });

  it("before a game: the morning of game day", () => {
    const kickoff = new Date("2026-10-20T02:30:00Z"); // Mon 7:30 PM in LA
    const t = sendTiming({ phase: "before", occurredAt: new Date("2026-10-18T20:00:00Z"), gameStart: kickoff, tz: LA, now: new Date("2026-10-18T20:00:00Z") });
    assert.equal(t.send_at_local, "Mon 8:00 AM PDT");
  });

  it("before a game, on game day: now, while there's time", () => {
    const kickoff = new Date("2026-10-20T02:30:00Z");
    const now = new Date("2026-10-19T18:00:00Z"); // 11 AM in LA
    assert.equal(sendTiming({ phase: "before", occurredAt: now, gameStart: kickoff, tz: LA, now }).send_at_utc, now.toISOString());
  });

  it("names British summer time as BST", () => {
    assert.equal(formatLocal(new Date("2026-10-19T07:00:00Z"), "Europe/London"), "Mon 8:00 AM BST");
    assert.equal(localTime(new Date("2026-10-19T07:00:00Z"), "Europe/London").weekday, "Monday");
  });
});
