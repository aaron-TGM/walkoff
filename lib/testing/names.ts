// For tests of shopper-facing copy: brands without a license never name the
// team, its league or the event.
import assert from "node:assert/strict";
import type { TeamRef } from "../mcp/teams";

export function assertNeverNames(text: string, t: TeamRef) {
  for (const name of [t.team.name, t.team.nickname]) assert.ok(!text.includes(name), `names ${name}`);
  assert.ok(!new RegExp(`\\b${t.team.abbr}\\b`).test(text), `names ${t.team.abbr}`);
  for (const mark of ["NFL", "NCAA", "Premier League", "Super Bowl"]) assert.ok(!text.includes(mark), `names ${mark}`);
}
