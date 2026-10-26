import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { EspnSummary } from "../espn/types";
import { addHeroes, heroesFor } from "./heroes";
import type { Moment } from "./types";

function summary(name: string): EspnSummary {
  return JSON.parse(readFileSync(new URL(`../__fixtures__/${name}.json`, import.meta.url), "utf8")) as EspnSummary;
}

const leaders = (h: ReturnType<typeof heroesFor>) => Object.fromEntries((h?.leaders ?? []).map((l) => [l.name, l.why]));

describe("heroesFor", () => {
  it("Super Bowl LX: Seattle's leaders and everyone with a line", () => {
    const sb = summary("nfl-summary-401772988");
    const h = heroesFor("football", sb, "26");
    assert.deepEqual(leaders(h), {
      "Sam Darnold": ["Passing Yards"],
      "Kenneth Walker III": ["Rushing Yards"],
      "Cooper Kupp": ["Receiving Yards"],
      "Derick Hall": ["Sacks"],
      "Ernest Jones IV": ["Tackles"],
    });
    assert.ok(h?.played.includes("3912547"));
    assert.equal(h?.played.length, 30);
    // New England's quarterback isn't one of Seattle's.
    assert.ok(!h?.played.includes("4431452"));
    assert.equal(heroesFor("football", sb, "17")?.leaders[0].name, "Drake Maye");
  });

  it("World Series Game 7: the winning pitcher and home runs at the plate", () => {
    const h = heroesFor("baseball", summary("mlb-summary-401809303"), "19");
    assert.deepEqual(leaders(h), {
      "Will Smith": ["Home Run"],
      "Max Muncy": ["Home Run"],
      "Miguel Rojas": ["Home Run"],
      "Yoshinobu Yamamoto": ["Winning Pitcher"],
    });
    // Ohtani pitched and gave one up: that's no home run of his.
    assert.ok(h?.played.includes("39832"));
    assert.equal(h?.played.length, 17);
  });

  it("NBA Finals: the bench that didn't play isn't counted", () => {
    const h = heroesFor("basketball", summary("nba-summary-401859967"), "18");
    assert.deepEqual(leaders(h), {
      "Jalen Brunson": ["Points"],
      "Mikal Bridges": ["Assists"],
      "Josh Hart": ["Rebounds"],
    });
    assert.equal(h?.played.length, 12);
    assert.ok(!h?.played.includes("5211983"), "did not play");
  });

  it("Stanley Cup Final: leaders and the three stars, once each", () => {
    const h = heroesFor("hockey", summary("nhl-summary-401874176"), "7");
    assert.deepEqual(leaders(h), {
      "Jackson Blake": ["Goals", "Assists", "Points", "Third Star"],
      "Brandon Bussi": ["Winning Goalie", "First Star"],
      "Taylor Hall": ["Second Star"],
    });
    assert.equal(h?.played.length, 19);
    // The losing goalie is featured too, for the other side.
    assert.ok(!heroesFor("hockey", summary("nhl-summary-401874176"), "37")?.leaders.some((l) => l.why.includes("Losing Goalie")));
  });

  it("nothing for a team the summary doesn't have", () => {
    assert.equal(heroesFor("football", summary("nfl-summary-401772988"), "99"), null);
    assert.equal(heroesFor("football", {}, "26"), null);
  });
});

describe("addHeroes", () => {
  const team = {
    id: "espn:nfl:26",
    league: "nfl",
    externalId: "26",
    abbreviation: "SEA",
    displayName: "Seattle Seahawks",
    shortName: "Seahawks",
    location: "Seattle",
    color: null,
    alternateColor: null,
  };
  const base: Moment = {
    dedupeKey: "title_won:espn:nfl:401772988:espn:nfl:26",
    type: "title_won",
    category: "sports",
    phase: "season",
    league: "nfl",
    gameId: "espn:nfl:401772988",
    team,
    opponent: null,
    headline: "Champions: Seahawks win the Super Bowl",
    intensity: 1,
    detail: { round: "Super Bowl LX" },
    occurredAt: "2026-02-09T03:10:00Z",
  };

  it("adds them to the title only", () => {
    const sb = summary("nfl-summary-401772988");
    const [title, win] = addHeroes([base, { ...base, type: "team_win", dedupeKey: "team_win:x" }], "football", sb);
    assert.equal(title.detail.round, "Super Bowl LX");
    assert.ok((title.detail.heroes as { played: string[] }).played.includes("3912547"));
    assert.equal(win.detail.heroes, undefined);
  });
});
