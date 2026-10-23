import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_RULE, matchingRule, momentWindow, type TriggerRule } from "./queue";

const NOW = new Date("2026-10-19T00:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const moment = (over: Partial<Parameters<typeof matchingRule>[0]> = {}) => ({
  type: "walkoff_win",
  intensity: 0.95,
  occurredAt: hoursAgo(1),
  gameStart: null,
  teamKey: "nfl:24",
  ...over,
});

describe("matchingRule", () => {
  const rivals: TriggerRule = { id: "t1", name: "Rivalry games", moment_types: ["rivalry_win", "rivalry_preview"], team_keys: ["nba:13"], min_intensity: 0, active: true };

  it("follows the brand's standout teams by default", () => {
    assert.equal(matchingRule(moment(), [DEFAULT_RULE], ["nfl:24"])?.id, "default");
    assert.equal(matchingRule(moment({ teamKey: "nfl:14" }), [DEFAULT_RULE], ["nfl:24"]), null);
    assert.equal(matchingRule(moment({ type: "close_game" }), [DEFAULT_RULE], ["nfl:24"]), null, "live moments aren't in the default");
    assert.equal(matchingRule(moment({ intensity: 0.5 }), [DEFAULT_RULE], ["nfl:24"]), null);
  });

  it("takes an ordinary football win by default, not every basketball win", () => {
    assert.equal(matchingRule(moment({ type: "team_win", intensity: 0.7 }), [DEFAULT_RULE], ["nfl:24"])?.id, "default");
    assert.equal(matchingRule(moment({ type: "team_win", intensity: 0.4, teamKey: "nba:13" }), [DEFAULT_RULE], ["nba:13"]), null);
  });

  it("matches a brand's own rules by type, team and intensity", () => {
    assert.equal(matchingRule(moment({ type: "rivalry_win", teamKey: "nba:13" }), [rivals], [])?.id, "t1");
    assert.equal(matchingRule(moment({ type: "walkoff_win", teamKey: "nba:13" }), [rivals], []), null);
    assert.equal(matchingRule(moment({ type: "rivalry_win", teamKey: "nba:13" }), [{ ...rivals, active: false }], []), null);
    assert.equal(matchingRule(moment({ teamKey: null }), [DEFAULT_RULE], ["nfl:24"]), null);
  });
});

describe("momentWindow", () => {
  it("gives a result about a day", () => {
    assert.equal(momentWindow(moment({ occurredAt: hoursAgo(2) }), NOW).status, "open");
    assert.equal(momentWindow(moment({ occurredAt: hoursAgo(25) }), NOW).status, "closing");
    assert.equal(momentWindow(moment({ occurredAt: hoursAgo(31) }), NOW).status, "closed");
  });

  it("keeps a pre-game moment open until the game starts", () => {
    const pre = moment({ type: "rivalry_preview", occurredAt: hoursAgo(10), gameStart: new Date(NOW.getTime() + 5 * 3_600_000) });
    const w = momentWindow(pre, NOW);
    assert.equal(w.status, "open");
    assert.equal(w.note, "The game starts in 5 hours.");
    assert.equal(momentWindow({ ...pre, gameStart: hoursAgo(1) }, NOW).status, "closed");
  });

  it("season moments last three days", () => {
    assert.equal(momentWindow(moment({ type: "playoff_clinch", occurredAt: hoursAgo(48) }), NOW).status, "open");
  });
});
