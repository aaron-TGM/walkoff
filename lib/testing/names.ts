// For tests of shopper-facing copy: brands without a license never name the
// team, its league or the event.
import assert from "node:assert/strict";
import type { TeamRef } from "../mcp/teams";

export function assertNeverNames(text: string, t: TeamRef) {
  for (const name of [t.team.name, t.team.nickname]) assert.ok(!text.includes(name), `names ${name}`);
  assert.ok(!new RegExp(`\\b${t.team.abbr}\\b`).test(text), `names ${t.team.abbr}`);
  for (const mark of ["NFL", "NCAA", "Premier League", "Super Bowl"]) assert.ok(!text.includes(mark), `names ${mark}`);
}

/** Words for what an athlete plays, which describe them as surely as a name. */
const POSITIONS = [
  "quarterback", "wide receiver", "running back", "tight end", "linebacker", "cornerback", "pitcher",
  "shortstop", "outfielder", "goalie", "goaltender", "defenseman", "point guard", "striker", "midfielder", "goalkeeper",
];
/** Ways of saying "someone from here" that point at an athlete. */
const LOCAL_PHRASES = ["local kid", "one of our own", "hometown hero", "hometown kid", "born and raised", "local hero", "native son"];
/** Events, tours and leagues, which hometown copy never names. */
const EVENT_MARKS = [
  "Super Bowl", "World Series", "Stanley Cup", "NBA Finals", "Masters", "U.S. Open", "US Open", "The Open", "Wimbledon",
  "Daytona 500", "PGA", "LPGA", "NASCAR", "F1", "Formula 1", "WSL", "NFL", "NBA", "NHL", "MLB", "NCAA", "Premier League",
];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** For hometown copy without rights: never the athlete, by name or any
 *  other way, and never the event. */
export function assertNeverNamesAthlete(text: string, a: { name: string; jersey?: string | null; position?: string | null }) {
  const lower = text.toLowerCase();
  assert.ok(!lower.includes(a.name.toLowerCase()), `names ${a.name}`);
  for (const part of a.name.split(/\s+/).filter((p) => p.length > 2 && !/^(jr|sr|ii|iii|iv)\.?$/i.test(p))) {
    assert.ok(!new RegExp(`\\b${escape(part)}\\b`, "i").test(text), `names ${part}`);
  }
  // "#14" and "No. 14", not HTML's "&#39;".
  if (a.jersey) assert.ok(!new RegExp(`((?<!&)#|\\bno\\.?\\s?|\\bnumber\\s)${escape(a.jersey)}\\b`, "i").test(text), `names number ${a.jersey}`);
  if (a.position) assert.ok(!new RegExp(`\\b${escape(a.position)}\\b`).test(text), `names ${a.position}`);
  for (const w of POSITIONS) assert.ok(!lower.includes(w), `says ${w}`);
  for (const p of LOCAL_PHRASES) assert.ok(!lower.includes(p), `says ${p}`);
  for (const m of EVENT_MARKS) assert.ok(!new RegExp(`\\b${escape(m)}\\b`).test(text), `names ${m}`);
}
