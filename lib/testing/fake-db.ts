// An in-memory stand-in for the Supabase client in unit tests: the part of
// the query builder Walkoff uses, over plain arrays of rows. Tables and
// columns are checked against the migrations. The end-to-end checks in
// CLAUDE.md run the same code against PostgREST.
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

/** Tables whose rows get a random uuid id when inserted without one. */
const UUID_IDS = new Set([
  "brands", "brand_uploads", "affinity_reports", "triggers", "sends", "moments", "athlete_results", "brand_athlete_rights",
  "prospects", "prospect_contacts", "outreach",
]);
/** Column defaults from the migrations that code reads back. */
const DEFAULTS: Record<string, Record<string, () => unknown>> = {
  moments: { detected_at: () => new Date().toISOString() },
  triggers: { active: () => true },
  prospects: { status: () => "new", home_teams: () => [], categories: () => [], apps: () => [], source: () => "storeleads" },
  prospect_contacts: { source: () => "csv" },
  outreach: { status: () => "drafted", views: () => 0 },
};

type Filter = (row: Row) => boolean;

type Schema = Map<string, Set<string>>;
const schemas = new Map<string, Schema>();

/** Tables and their columns from supabase/0*.sql, up to the migration
 *  numbered through (all of them by default), so a query naming one that
 *  doesn't exist fails here as it would in PostgREST. */
function schemaThrough(through = "999"): Schema {
  let schema = schemas.get(through);
  if (!schema) {
    schema = new Map();
    const dir = new URL("../../supabase/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => /^0\d+_.*\.sql$/.test(f) && f.slice(0, 3) <= through).sort()) {
      const sql = readFileSync(new URL(file, dir), "utf8");
      for (const [, name, body] of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)) {
        const cols = schema.get(name) ?? new Set<string>();
        for (const line of body.split("\n")) {
          const col = line.trim().match(/^([a-z_]+)\s+[a-z]/)?.[1];
          if (col) cols.add(col);
        }
        schema.set(name, cols);
      }
      for (const [, name, col] of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/g)) {
        schema.set(name, (schema.get(name) ?? new Set<string>()).add(col));
      }
    }
    schemas.set(through, schema);
  }
  return schema;
}
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

/** "a, alias:b->c->>d" into output keys and paths into each row. */
function projection(columns: string): ((row: Row) => [string, unknown][]) {
  const items = columns.split(",").map((s) => s.trim()).filter(Boolean);
  return (row) =>
    items.flatMap((item): [string, unknown][] => {
      if (item === "*") return Object.entries(row);
      const [alias, expr] = item.includes(":") ? item.split(":") : [null, item];
      const parts = expr.split(/(->>|->)/);
      let value: unknown = row[parts[0]];
      let key = parts[0];
      for (let i = 1; i < parts.length; i += 2) {
        key = parts[i + 1];
        value = value && typeof value === "object" ? (value as Row)[key] : null;
        if (parts[i] === "->>" && value !== null && value !== undefined) value = typeof value === "string" ? value : JSON.stringify(value);
      }
      return [[alias ?? key, value ?? null]];
    });
}

/** supabase-js writes an array of rows with every key any of them has, and
 *  PostgREST stores null where a row leaves one out, existing rows included. */
function sameColumns(rows: Row[]): Row[] {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, k in r ? r[k] : null])));
}

const compare = (a: unknown, b: unknown) =>
  a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : (a as string) < (b as string) ? -1 : 1;

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private columns: string | null = null;
  private countRows = false;
  private head = false;
  private payload: Row[] = [];
  private changes: Row = {};
  private conflict: string[] = [];
  private ignoreDuplicates = false;
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private window: { from: number; to: number } | null = null;
  private one: "single" | "maybe" | null = null;
  private problem: string | null = null;
  private readonly known: Set<string> | undefined;

  constructor(
    private readonly tables: Tables,
    private readonly table: string,
    schema: Schema,
  ) {
    this.known = schema.get(table);
    if (!this.known) this.problem = `relation "public.${table}" does not exist`;
  }

  private uses(...columns: string[]) {
    for (const c of columns) if (this.known && !this.known.has(c)) this.problem ??= `column ${this.table}.${c} does not exist`;
  }

  select(columns = "*", opts: { count?: "exact"; head?: boolean } = {}) {
    for (const item of columns.split(",").map((s) => s.trim())) {
      if (item && item !== "*") this.uses((item.includes(":") ? item.split(":")[1] : item).split(/->>?/)[0]);
    }
    this.columns = columns;
    this.countRows = opts.count === "exact";
    this.head = !!opts.head;
    return this;
  }

  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? sameColumns(rows) : [rows];
    this.payload.forEach((r) => this.uses(...Object.keys(r)));
    return this;
  }

  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? sameColumns(rows) : [rows];
    this.conflict = (opts.onConflict ?? "id").split(",").map((s) => s.trim());
    this.ignoreDuplicates = !!opts.ignoreDuplicates;
    this.payload.forEach((r) => this.uses(...Object.keys(r)));
    this.uses(...this.conflict);
    return this;
  }

  update(changes: Row) {
    this.op = "update";
    this.changes = changes;
    this.uses(...Object.keys(changes));
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.uses(column);
    this.filters.push((r) => r[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.uses(column);
    // jsonb columns compare with their JSON text, like neq("teams", "[]").
    this.filters.push((r) => (r[column] !== null && typeof r[column] === "object" ? JSON.stringify(r[column]) : r[column]) !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.uses(column);
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }

  is(column: string, value: null) {
    this.uses(column);
    this.filters.push((r) => (r[column] ?? null) === value);
    return this;
  }

  gt(column: string, value: unknown) {
    this.uses(column);
    this.filters.push((r) => compare(r[column], value) > 0 && r[column] != null);
    return this;
  }

  gte(column: string, value: unknown) {
    this.uses(column);
    this.filters.push((r) => compare(r[column], value) >= 0 && r[column] != null);
    return this;
  }

  not(column: string, operator: string, value: string | null) {
    this.uses(column);
    if (operator === "is" && value === null) {
      this.filters.push((r) => (r[column] ?? null) !== null);
      return this;
    }
    if (operator !== "in" || value === null) throw new Error(`fake db: not.${operator} isn't supported`);
    const values = value.replace(/^\(|\)$/g, "").split(",");
    this.filters.push((r) => !values.includes(String(r[column])));
    return this;
  }

  order(column: string, opts: { ascending?: boolean } = {}) {
    this.uses(column);
    this.orders.push({ column, ascending: opts.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.window = { from: 0, to: n - 1 };
    return this;
  }

  range(from: number, to: number) {
    this.window = { from, to };
    return this;
  }

  single() {
    this.one = "single";
    return this;
  }

  maybeSingle() {
    this.one = "maybe";
    return this;
  }

  then<A = Result, B = never>(resolve?: ((r: Result) => A | PromiseLike<A>) | null, reject?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }

  private matching(rows: Row[]) {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private run(): Result {
    // Postgres's codes for a missing table and a missing column.
    if (this.problem) return { data: null, error: { message: this.problem, code: this.known ? "42703" : "42P01" } };
    const rows = (this.tables[this.table] ??= []);
    let out: Row[];
    if (this.op === "select") {
      out = this.matching(rows);
      for (const o of [...this.orders].reverse()) out.sort((a, b) => compare(a[o.column], b[o.column]) * (o.ascending ? 1 : -1));
    } else if (this.op === "delete") {
      out = this.matching(rows);
      this.tables[this.table] = rows.filter((r) => !out.includes(r));
    } else if (this.op === "update") {
      out = this.matching(rows);
      for (const r of out) Object.assign(r, this.changes);
    } else {
      out = [];
      for (const p of this.payload) {
        const existing = this.op === "upsert" ? rows.find((r) => this.conflict.every((c) => r[c] === p[c])) : undefined;
        if (existing) {
          if (this.ignoreDuplicates) continue;
          Object.assign(existing, p);
          out.push(existing);
          continue;
        }
        const defaults = Object.fromEntries(Object.entries(DEFAULTS[this.table] ?? {}).map(([c, value]) => [c, value()]));
        const row = { ...(UUID_IDS.has(this.table) ? { id: randomUUID() } : {}), created_at: new Date().toISOString(), ...defaults, ...p };
        rows.push(row);
        out.push(row);
      }
    }
    const total = out.length;
    if (this.window) out = out.slice(this.window.from, this.window.to + 1);
    const wantsRows = this.op === "select" || this.columns !== null;
    const project = projection(this.columns ?? "*");
    const data = this.head || !wantsRows ? null : out.map((r) => Object.fromEntries(project(r)));
    const count = this.countRows ? total : null;
    if (this.one && Array.isArray(data)) {
      if (data.length > 1 || (this.one === "single" && data.length === 0)) {
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count };
      }
      return { data: data[0] ?? null, error: null, count };
    }
    return { data, error: null, count };
  }
}

/** through: "008" is the database before 009 has run. */
export function fakeDb(tables: Tables = {}, options: { through?: string } = {}): SupabaseClient & { tables: Tables } {
  const schema = schemaThrough(options.through);
  const db = {
    tables,
    from: (table: string) => new Query(tables, table, schema),
    rpc: async () => ({ data: null, error: null }),
  };
  return db as unknown as SupabaseClient & { tables: Tables };
}

/** A database any use of fails, for code that shouldn't touch one. */
export const noDb = new Proxy(
  {},
  {
    get() {
      throw new Error("No database call was expected.");
    },
  },
) as SupabaseClient;
