import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { TRIGGERS } from "../../lib/triggers";
import { normalizeScoreboard, scoringEventsFromSummary } from "../espn/normalize";
import {
  finalMoments,
  finalStatus,
  liveMoments,
  preMoments,
  track,
} from "./rules";
import { rulesFor } from "./sports";
import type { GameState, Moment, MomentType } from "./types";

const NOW = new Date("2026-10-22T13:00:00Z");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8"));
}

function games(league: string, name: string): GameState[] {
  return normalizeScoreboard(league, fixture(name) as never);
}

function game(league: string, name: string, shortName: string): GameState {
  const g = games(league, name).find((x) => x.shortName === shortName);
  assert.ok(g, `${shortName} not in ${name}`);
  return g;
}

function finals(g: GameState, summary?: string): Moment[] {
  const events = summary ? scoringEventsFromSummary(g.sport, fixture(summary) as never) : null;
  return finalMoments(track(null, g, NOW), rulesFor(g.league), events, NOW);
}

/** "type:ABBR" for each moment, for compact assertions. */
function kinds(ms: Moment[]): string[] {
  return ms.map((m) => `${m.type}:${m.team.abbreviation}`).sort();
}

describe("final moments from real games", () => {
  it("baseball walk-off in the NLDS", () => {
    const ms = finals(game("mlb", "mlb-nlds-walkoff", "SD @ MIL"));
    assert.deepEqual(kinds(ms), ["heartbreak_loss:SD", "walkoff_win:MIL"]);
    const walkoff = ms.find((m) => m.type === "walkoff_win");
    assert.equal(walkoff?.headline, "Walk-off win: Brewers 4, Padres 3");
    assert.equal(walkoff?.intensity, 1, "postseason walk-off is maxed out");
  });

  it("finds exactly the two extra-inning walk-offs on a full day of baseball", () => {
    const all = games("mlb", "mlb-0923").flatMap((g) => finals(g));
    const walkoffs = all.filter((m) => m.type === "walkoff_win").map((m) => m.team.abbreviation);
    assert.deepEqual(walkoffs.sort(), ["ATL", "SEA"]);
  });

  it("Mariners came back from 4 down before walking it off", () => {
    const ms = finals(game("mlb", "mlb-0923", "HOU @ SEA"));
    assert.deepEqual(kinds(ms), ["comeback_win:SEA", "heartbreak_loss:HOU", "walkoff_win:SEA"]);
    assert.equal(ms.find((m) => m.type === "comeback_win")?.detail.deficit, 4);
  });

  it("series clinch is a playoff advance, not a title", () => {
    const ms = finals(game("mlb", "mlb-nlcs-clinch", "MIL @ LAD"));
    const advance = ms.find((m) => m.type === "playoff_advance");
    assert.equal(advance?.team.abbreviation, "MIL");
    assert.equal(advance?.headline, "Advancing: Brewers win the NLCS");
    assert.ok(!ms.some((m) => m.type === "title_won"));
  });

  it("hockey overtime and shootout winners", () => {
    assert.deepEqual(kinds(finals(game("nhl", "nhl-1008", "SJ @ STL"))), [
      "heartbreak_loss:STL",
      "walkoff_win:SJ",
    ]);
    const so = finals(game("nhl", "nhl-1008", "TOR @ VGK"));
    assert.deepEqual(kinds(so), ["comeback_win:VGK", "heartbreak_loss:TOR", "walkoff_win:VGK"]);
    assert.match(so.find((m) => m.type === "walkoff_win")?.headline ?? "", /^Shootout winner/);
  });

  it("football overtime winner uses the play-by-play", () => {
    const ms = finals(game("nfl", "nfl-week1", "NO @ DET"), "nfl-summary-401872923");
    assert.deepEqual(kinds(ms), ["heartbreak_loss:NO", "walkoff_win:DET"]);
    const decisive = ms.find((m) => m.type === "walkoff_win")?.detail.decisive as { period: number };
    assert.equal(decisive.period, 5);
  });

  it("a go-ahead score with 5:50 left is not a walk-off", () => {
    const ms = finals(game("nfl", "nfl-week1", "NE @ SEA"), "nfl-summary-401872656");
    assert.deepEqual(kinds(ms), ["heartbreak_loss:NE"]);
  });

  it("division rivals get a rivalry win", () => {
    assert.deepEqual(kinds(finals(game("nfl", "nfl-week1", "WSH @ PHI"))), [
      "heartbreak_loss:WSH",
      "rivalry_win:PHI",
    ]);
  });

  it("basketball go-ahead with 1:23 left is not a buzzer beater", () => {
    const ms = finals(game("nba", "nba-1021", "IND @ NO"), "nba-summary-401909839");
    assert.deepEqual(kinds(ms), ["heartbreak_loss:NO"]);
  });

  it("soccer late winners from the goal list", () => {
    const leeds = finals(game("epl", "epl-0822", "LEE @ NFO"));
    assert.deepEqual(kinds(leeds), ["heartbreak_loss:NFO", "late_winner:LEE"]);
    assert.equal(leeds.find((m) => m.type === "late_winner")?.detail.minute, 88);
    const ipswich = finals(game("epl", "epl-0822", "SUN @ IPS"));
    assert.equal(ipswich.find((m) => m.type === "late_winner")?.intensity, 0.9);
  });

  it("soccer: early winner and late consolation goal is nothing special", () => {
    assert.deepEqual(finals(game("epl", "epl-0830", "BHA @ CHE")), []);
  });

  it("a lopsided loss after an early lead is not a heartbreaker", () => {
    const ms = finals(game("epl", "epl-0830", "IPS @ MAN"));
    assert.deepEqual(kinds(ms), ["comeback_win:MAN"]);
  });

  it("every emitted moment type is in the site's trigger library", () => {
    const ids = new Set(TRIGGERS.map((t) => t.id));
    const types: MomentType[] = [
      "rivalry_preview",
      "big_game_alert",
      "season_opener",
      "close_game",
      "comeback_live",
      "clutch_moment",
      "walkoff_win",
      "buzzer_beater",
      "late_winner",
      "comeback_win",
      "rivalry_win",
      "heartbreak_loss",
      "playoff_advance",
      "title_won",
    ];
    for (const t of types) assert.ok(ids.has(t), `${t} missing from lib/triggers.ts`);
  });
});

describe("before the game", () => {
  it("World Series Game 1 is a big game for both teams", () => {
    const g = game("mlb", "mlb-ws-game1-pre", "TB @ MIL");
    const ms = preMoments(g, new Date("2026-10-23T12:00:00Z"));
    assert.deepEqual(kinds(ms), ["big_game_alert:MIL", "big_game_alert:TB"]);
    assert.equal(ms[0].intensity, 0.85);
    assert.match(ms[0].headline, /World Series - Game 1, Rays at Brewers, Fri 8:00 PM ET/);
  });

  it("too far out is nothing yet", () => {
    const g = game("mlb", "mlb-ws-game1-pre", "TB @ MIL");
    assert.deepEqual(preMoments(g, new Date("2026-10-21T12:00:00Z")), []);
  });

  it("rivalry preview inside 48 hours", () => {
    const base = game("nfl", "nfl-week1", "WSH @ PHI");
    const g: GameState = { ...base, state: "pre", completed: false, startsAt: "2026-10-24T00:00:00Z" };
    const ms = preMoments(g, new Date("2026-10-22T13:00:00Z"));
    assert.deepEqual(kinds(ms), ["rivalry_preview:PHI", "rivalry_preview:WSH"]);
  });

  it("season opener when a team's record is 0-0", () => {
    const base = game("nba", "nba-1021", "IND @ NO");
    const g: GameState = {
      ...base,
      state: "pre",
      completed: false,
      startsAt: "2026-10-22T23:00:00Z",
      home: { ...base.home, record: "0-0" },
      away: { ...base.away, record: "1-0" },
    };
    assert.deepEqual(kinds(preMoments(g, NOW)), ["season_opener:NO"]);
  });
});

describe("during the game", () => {
  function live(base: GameState, patch: Partial<GameState>): GameState {
    return { ...base, state: "in", completed: false, ...patch };
  }

  it("close game late in the fourth", () => {
    const base = game("nfl", "nfl-week1", "WSH @ PHI");
    const g = live(base, {
      period: 4,
      clockSeconds: 200,
      home: { ...base.home, score: 21 },
      away: { ...base.away, score: 17 },
    });
    const ms = liveMoments(track(null, g, NOW), rulesFor("nfl"), NOW);
    assert.deepEqual(kinds(ms), ["close_game:PHI", "close_game:WSH"]);
  });

  it("not close yet in the third quarter", () => {
    const base = game("nfl", "nfl-week1", "WSH @ PHI");
    const g = live(base, { period: 3, clockSeconds: 200 });
    assert.deepEqual(liveMoments(track(null, g, NOW), rulesFor("nfl"), NOW), []);
  });

  it("comeback on after being down 17", () => {
    const base = game("nfl", "nfl-week1", "WSH @ PHI");
    const early = live(base, {
      period: 2,
      clockSeconds: 300,
      home: { ...base.home, score: 0, linescores: [] },
      away: { ...base.away, score: 17, linescores: [] },
    });
    const later = live(base, {
      period: 3,
      clockSeconds: 600,
      home: { ...base.home, score: 14, linescores: [] },
      away: { ...base.away, score: 17, linescores: [] },
    });
    const t = track(track(null, early, NOW), later, NOW);
    const ms = liveMoments(t, rulesFor("nfl"), NOW);
    assert.deepEqual(kinds(ms), ["comeback_live:PHI"]);
    assert.equal(ms[0].detail.deficit, 17);
  });

  it("bases loaded, bottom of the ninth, down one", () => {
    const base = game("mlb", "mlb-nlds-walkoff", "SD @ MIL");
    const g = live(base, {
      period: 9,
      inningHalf: "bottom",
      statusDetail: "Bot 9th",
      home: { ...base.home, score: 2 },
      away: { ...base.away, score: 3 },
      situation: { onFirst: true, onSecond: true, onThird: true, outs: 2, possessionExternalId: null },
    });
    const ms = liveMoments(track(null, g, NOW), rulesFor("mlb"), NOW).filter(
      (m) => m.type === "clutch_moment",
    );
    assert.equal(ms.length, 1);
    assert.equal(ms[0].team.abbreviation, "MIL");
    assert.match(ms[0].headline, /bases loaded, Brewers down 1, Bot 9th/);
  });
});

describe("final freshness", () => {
  const rules = rulesFor("nba");
  const g = game("nba", "nba-1021", "IND @ NO");

  it("processes a final it watched go final", () => {
    const prev = track(null, { ...g, state: "in", completed: false }, NOW);
    const t = track(prev, g, NOW);
    assert.equal(finalStatus(prev, t, rules, NOW), "process");
  });

  it("skips an old final seen for the first time", () => {
    const t = track(null, g, NOW);
    assert.equal(finalStatus(null, t, rules, NOW), "stale");
  });

  it("processes a fresh final seen for the first time", () => {
    const justNow = new Date(Date.parse(g.startsAt) + 150 * 60_000);
    const t = track(null, g, justNow);
    assert.equal(finalStatus(null, t, rules, justNow), "process");
  });

  it("never processes the same final twice", () => {
    const t = { ...track(null, g, NOW), finalProcessed: true };
    assert.equal(finalStatus(t, t, rules, NOW), "skip");
  });
});
