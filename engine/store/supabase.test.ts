import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { normalizeScoreboard } from "../espn/normalize";
import { finalMoments, track } from "../moments/rules";
import { rulesFor } from "../moments/sports";
import { gameRow, momentRow, teamRow } from "./supabase";

// Catches a column renamed in code but not in the migration (or the reverse).
function columns(table: string): Set<string> {
  const sql = readFileSync(
    new URL("../../supabase/003_moment_engine.sql", import.meta.url),
    "utf8",
  );
  const body = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`))?.[1];
  assert.ok(body, `table ${table} not found in migration`);
  return new Set(
    body
      .split("\n")
      .map((line) => line.trim().match(/^([a-z_]+)\s+[a-z]/)?.[1])
      .filter((c): c is string => Boolean(c)),
  );
}

function assertFits(table: string, row: Record<string, unknown>): void {
  const cols = columns(table);
  for (const key of Object.keys(row)) assert.ok(cols.has(key), `${table}.${key} is not a column`);
}

describe("Supabase rows match the migration", () => {
  const board = JSON.parse(
    readFileSync(new URL("../__fixtures__/mlb-nlds-walkoff.json", import.meta.url), "utf8"),
  );
  const [g] = normalizeScoreboard("mlb", board);
  const t = track(null, g, new Date("2026-10-05T03:00:00Z"));
  const [m] = finalMoments(t, rulesFor("mlb"), null, new Date("2026-10-05T03:00:00Z"));

  it("teams", () => assertFits("teams", teamRow(g.home.team)));
  it("games", () => assertFits("games", gameRow(t)));
  it("moments", () => assertFits("moments", momentRow(m)));
});
