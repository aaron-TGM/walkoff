import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { normalizeScoreboard } from "../espn/normalize";
import { finalMoments, track } from "../moments/rules";
import { rulesFor } from "../moments/sports";
import { fakeDb } from "../../lib/testing/fake-db";
import { createSupabaseStore, gameRow, momentRow, teamRow } from "./supabase";

// Catches a column renamed in code but not in the migrations (or the reverse).
function columns(table: string): Set<string> {
  const dir = new URL("../../supabase/", import.meta.url);
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .join("\n");
  const body = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`))?.[1];
  assert.ok(body, `table ${table} not found in migration`);
  const added = [...sql.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ([a-z_]+)`, "g"))];
  return new Set([
    ...body
      .split("\n")
      .map((line) => line.trim().match(/^([a-z_]+)\s+[a-z]/)?.[1])
      .filter((c): c is string => Boolean(c)),
    ...added.map((m) => m[1]),
  ]);
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
  it("games before 013_final_processed.sql", () => assert.equal("final_processed" in gameRow(t, false), false));
  it("moments", () => assertFits("moments", momentRow(m)));
});

describe("whether a final's moments are saved", () => {
  const board = JSON.parse(
    readFileSync(new URL("../__fixtures__/mlb-nlds-walkoff.json", import.meta.url), "utf8"),
  );
  const [g] = normalizeScoreboard("mlb", board);
  const t = { ...track(null, g, new Date("2026-10-05T03:00:00Z")), finalProcessed: true };
  const since = new Date(0);

  it("is saved and restored", async () => {
    const db = fakeDb();
    const store = createSupabaseStore(db);
    await store.saveTeams([g.home.team, g.away.team]);
    await store.saveGames([t]);
    const [restored] = await store.loadRecentGames("mlb", since);
    assert.equal(restored.finalProcessed, true);
  });

  it("is left out until 013_final_processed.sql has run", async () => {
    const db = fakeDb({}, { through: "012" });
    const store = createSupabaseStore(db);
    await store.saveTeams([g.home.team, g.away.team]);
    await store.saveGames([t]);
    assert.equal(db.tables.games.length, 1);
    const [restored] = await store.loadRecentGames("mlb", since);
    assert.equal(restored.finalProcessed, null);
  });
});
