import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { normalizeScoreboard, scoringEventsFromSummary } from "../espn/normalize";
import type { EspnSummary } from "../espn/types";
import { addDeciders, deciderFor, GAME_WINNER, namesInScore, type Decider } from "./deciders";
import type { Heroes } from "./heroes";
import { finalMoments, track } from "./rules";
import { rulesFor } from "./sports";
import type { Moment } from "./types";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));

/** A real playoff final: the game, its summary, and its moments as the
 *  poller makes them. */
function final(league: string, board: string, summary: string) {
  const rules = rulesFor(league);
  const [g] = normalizeScoreboard(league, fixture(board));
  const s = fixture(summary) as EspnSummary;
  const now = new Date(Date.parse(g.startsAt) + 4 * 3_600_000);
  const events = g.sport === "football" || g.sport === "basketball" ? scoringEventsFromSummary(g.sport, s) : null;
  const moments = finalMoments(track(null, g, now), rules, events, now);
  const finish = moments.find((m) => m.type === "walkoff_win" || m.type === "buzzer_beater")!;
  return { g, s, rules, moments, finish };
}

const deciderOf = (moments: Moment[]) => moments.find((m) => m.detail.decider)?.detail.decider as Decider | undefined;
const who = (d: Decider | null | undefined) => d?.athletes.map((a) => `${a.name} (${a.id})`);

describe("deciderFor, on real playoff finals", () => {
  it("MLB, NLDS Game 2: the batter of the walk-off single", () => {
    const { g, s, rules, finish } = final("mlb", "mlb-nlds-walkoff", "mlb-summary-401908003");
    assert.equal(finish.type, "walkoff_win");
    const d = deciderFor(g, s, finish.team.externalId, rules.regulationPeriods);
    assert.deepEqual(who(d), ["Jackson Chourio (4917869)"]);
    assert.match(d!.play, /^Chourio singled to center, Frelick scored and Yelich scored/);
  });

  it("NHL, West 1st Round Game 4: the scorer of the overtime goal, not the assist", () => {
    const { g, s, rules, finish } = final("nhl", "nhl-playoff-ot", "nhl-summary-401869772");
    assert.equal(finish.team.abbreviation, "ANA");
    const d = deciderFor(g, s, finish.team.externalId, rules.regulationPeriods);
    assert.deepEqual(who(d), ["Ryan Poehling (4233668)"]);
    assert.match(d!.play, /^Ryan Poehling Goal/);
  });

  it("NBA Finals Game 4: the shooter of the buzzer-beater", () => {
    const { g, s, rules, finish } = final("nba", "nba-finals-g4", "nba-summary-401859966");
    assert.equal(finish.type, "buzzer_beater");
    assert.deepEqual(who(deciderFor(g, s, finish.team.externalId, rules.regulationPeriods)), ["OG Anunoby (3934719)"]);
  });

  it("NFL, AFC Divisional: the kicker, named in the play and found in the box score", () => {
    const { g, s, rules, finish } = final("nfl", "nfl-divisional-ot", "nfl-summary-401772982");
    assert.equal(finish.detail.overtime, true);
    const d = deciderFor(g, s, finish.team.externalId, rules.regulationPeriods);
    assert.deepEqual(who(d), ["Wil Lutz (2985659)"]);
    assert.equal(d!.play, "Wil Lutz 23 Yd Field Goal");
  });

  it("Hawaiʻi Bowl: a walk-off touchdown pass is the receiver, then the passer", () => {
    const { g, s, rules, finish } = final("ncaaf", "ncaaf-hawaii-bowl", "ncaaf-summary-401778312");
    assert.deepEqual(who(deciderFor(g, s, finish.team.externalId, rules.regulationPeriods)), ["Nick Cenacle (5092477)", "Luke Weaver (5295238)"]);
  });

  it("nobody, when the walk-off scored on an error or a wild pitch", () => {
    const { g, s, rules, finish } = final("mlb", "mlb-nlds-walkoff", "mlb-summary-401908003");
    for (const text of ["Ortiz scored on a wild pitch.", "Chourio reached on fielding error by shortstop Bogaerts, Frelick scored."]) {
      const changed = structuredClone(s);
      changed.plays!.filter((p) => p.scoringPlay).at(-1)!.text = text;
      assert.equal(deciderFor(g, changed, finish.team.externalId, rules.regulationPeriods), null, text);
    }
  });
});

describe("addDeciders", () => {
  it("puts the decider on a playoff walk-off", () => {
    const { g, s, rules, moments } = final("nhl", "nhl-playoff-ot", "nhl-summary-401869772");
    assert.deepEqual(who(deciderOf(addDeciders(moments, g, s, rules.regulationPeriods))), ["Ryan Poehling (4233668)"]);
  });

  it("leaves the regular season alone", () => {
    const { g, s, rules, moments } = final("nhl", "nhl-playoff-ot", "nhl-summary-401869772");
    assert.deepEqual(addDeciders(moments, { ...g, seasonType: 2 }, s, rules.regulationPeriods), moments);
  });

  it("in a title game, makes the decider one of the champion's leaders instead", () => {
    const { g, s, rules, moments, finish } = final("nba", "nba-finals-g4", "nba-summary-401859966");
    const heroes: Heroes = { leaders: [{ id: "3934719", name: "OG Anunoby", why: ["Rebounds"] }, { id: "3934672", name: "Jalen Brunson", why: ["Points"] }], played: ["3934672", "3934719"] };
    const title: Moment = { ...finish, type: "title_won", dedupeKey: `title_won:${g.id}:${finish.team.id}`, detail: { ...finish.detail, heroes } };
    const out = addDeciders([...moments, title], g, s, rules.regulationPeriods);
    assert.equal(deciderOf(out), undefined, "no game-winner moment of its own");
    const leaders = (out.find((m) => m.type === "title_won")!.detail.heroes as Heroes).leaders;
    assert.deepEqual(leaders[0], { id: "3934719", name: "OG Anunoby", why: [GAME_WINNER, "Rebounds"] });
    assert.equal(leaders.length, 2);
  });
});

describe("namesInScore", () => {
  it("reads who a football score names", () => {
    assert.deepEqual(namesInScore("Jaxon Smith-Njigba 45 Yd pass from Drew Lock (Jason Myers Kick)"), ["Jaxon Smith-Njigba", "Drew Lock"]);
    assert.deepEqual(namesInScore("Kenneth Walker III 3 Yd Run (Jason Myers Kick)"), ["Kenneth Walker III"]);
    assert.deepEqual(namesInScore("Harrison Mevis 42 Yd Field Goal "), ["Harrison Mevis"]);
    assert.deepEqual(namesInScore("Ernest Jones IV 32 Yd Interception Return (Jason Myers Kick)"), ["Ernest Jones IV"]);
    assert.deepEqual(namesInScore("Team Safety"), []);
  });
});
