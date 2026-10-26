import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { engineChecks, type HeartbeatRow } from "./status";

const NOW = Date.parse("2026-10-26T18:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const beat = (league: string, minutes: number, more: Partial<HeartbeatRow> = {}): HeartbeatRow => ({
  league,
  last_poll_at: ago(minutes),
  last_ok_at: ago(minutes),
  last_error: null,
  live_games: 0,
  games: 0,
  consecutive_failures: 0,
  ...more,
});

describe("engineChecks", () => {
  it("has a row per league and tour, then rosters and hometown moments", () => {
    const rows = [beat("hometown", 2), beat("golf:pga", 4, { live_games: 1 }), beat("nfl", 1, { live_games: 3 }), beat("athletes", 10, { games: 640 })];
    const checks = engineChecks(rows, new Map([["nfl", 2], ["hometown", 3]]), NOW);
    assert.deepEqual(
      checks.map((c) => [c.name, c.state, c.detail]),
      [
        ["NFL moments", "operational", "Polled 60s ago · 3 live · 2 moments today"],
        ["PGA Tour winners", "operational", "Polled 4m ago · 1 event under way"],
        ["Rosters and hometowns", "operational", "Checked 10m ago · 640 teams read in the last day"],
        ["Hometown moments", "operational", "Checked 2m ago · 3 towns today"],
      ],
    );
  });

  it("gives a tour longer than a league before it's down", () => {
    const checks = engineChecks([beat("nfl", 20), beat("tennis:atp", 20), beat("racing:f1", 40)], new Map(), NOW);
    assert.deepEqual(
      checks.map((c) => [c.name, c.state]),
      [
        ["NFL moments", "down"],
        ["ATP Tour winners", "operational"],
        ["Formula 1 winners", "down"],
      ],
    );
    assert.equal(checks[2].detail, "Last good poll 40m ago");
  });

  it("says a job is retrying, never what the error was", () => {
    const [c] = engineChecks([beat("hometown", 3, { consecutive_failures: 2, last_error: "relation athlete_results does not exist" })], new Map(), NOW);
    assert.equal(c.state, "degraded");
    assert.equal(c.detail, "Last good poll 3m ago · retrying");
  });

  it("leaves out rows it doesn't know", () => {
    assert.deepEqual(engineChecks([beat("golf:senior", 1), beat("wnba", 1)], new Map(), NOW), []);
  });
});
