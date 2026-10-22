// Reads and writes for the MCP tools (supabase/003, 004 and 006), always
// within the brands the signed-in person may use.
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEAM_HOMES } from "../affinity/geo";
import { TRIGGERS } from "../triggers";
import { teamFromFeedId } from "./teams";

export interface Principal {
  email: string;
  /** Null: every brand (Walkoff operators). */
  brandIds: string[] | null;
  clientId: string;
  scope: string;
}

/** A problem the person can fix, said in words they can act on. */
export class ToolError extends Error {}

export interface BrandRow {
  id: string;
  name: string;
  store_url: string | null;
  licensed: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export async function brandsFor(db: SupabaseClient, p: Principal): Promise<BrandRow[]> {
  if (p.brandIds && !p.brandIds.length) return [];
  let q = db.from("brands").select("id, name, store_url, licensed").order("name");
  if (p.brandIds) q = q.in("id", p.brandIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BrandRow[];
}

/** The brand a tool call means: by id or name, or the only one there is. */
export async function brandFor(db: SupabaseClient, p: Principal, ref?: string | null): Promise<BrandRow> {
  const brands = await brandsFor(db, p);
  if (!brands.length) throw new ToolError("No brands are set up for you yet. Ask your Walkoff contact to invite you.");
  const r = ref?.trim().toLowerCase();
  if (!r) {
    if (brands.length === 1) return brands[0];
    throw new ToolError(`Which brand? You have ${brands.map((b) => b.name).join(", ")}.`);
  }
  const exact = brands.find((b) => b.id === r || b.name.toLowerCase() === r);
  if (exact) return exact;
  const partial = brands.filter((b) => b.name.toLowerCase().includes(r));
  if (partial.length === 1) return partial[0];
  throw new ToolError(`No brand matches "${ref}". You have ${brands.map((b) => b.name).join(", ")}.`);
}

// ── Moments and games ──────────────────────────────────────────────

export interface MomentRow {
  id: string;
  type: string;
  phase: string;
  league: string;
  game_id: string | null;
  team_id: string | null;
  opponent_team_id: string | null;
  headline: string;
  intensity: number;
  detail: Record<string, unknown>;
  occurred_at: string;
  detected_at: string;
}

const MOMENT_COLUMNS =
  "id, type, phase, league, game_id, team_id, opponent_team_id, headline, intensity, detail, occurred_at, detected_at";

export async function recentMoments(
  db: SupabaseClient,
  opts: { teamIds?: string[]; since: Date; types?: string[]; limit?: number },
): Promise<MomentRow[]> {
  if (opts.teamIds && !opts.teamIds.length) return [];
  let q = db
    .from("moments")
    .select(MOMENT_COLUMNS)
    .gte("detected_at", opts.since.toISOString())
    .order("detected_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.teamIds) q = q.in("team_id", opts.teamIds);
  if (opts.types?.length) q = q.in("type", opts.types);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MomentRow[];
}

export async function momentsByIds(db: SupabaseClient, ids: string[]): Promise<Map<string, MomentRow>> {
  const unique = [...new Set(ids.filter(isUuid))];
  if (!unique.length) return new Map();
  const { data, error } = await db.from("moments").select(MOMENT_COLUMNS).in("id", unique);
  if (error) throw error;
  return new Map(((data ?? []) as MomentRow[]).map((m) => [m.id, m]));
}

export async function momentById(db: SupabaseClient, id: string): Promise<MomentRow | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db.from("moments").select(MOMENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as MomentRow | null) ?? null;
}

export interface GameRow {
  id: string;
  league: string;
  name: string;
  starts_at: string;
  state: string;
  status_detail: string | null;
  headline: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
}

const GAME_COLUMNS = "id, league, name, starts_at, state, status_detail, headline, home_team_id, away_team_id, home_score, away_score";

export async function gamesById(db: SupabaseClient, ids: string[]): Promise<Map<string, GameRow>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await db.from("games").select(GAME_COLUMNS).in("id", unique);
  if (error) throw error;
  return new Map(((data ?? []) as GameRow[]).map((g) => [g.id, g]));
}

/** Games that haven't started yet for any of these teams. */
export async function upcomingGames(db: SupabaseClient, teamIds: string[], from: Date, to: Date): Promise<GameRow[]> {
  if (!teamIds.length) return [];
  const list = teamIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
  const { data, error } = await db
    .from("games")
    .select(GAME_COLUMNS)
    .eq("state", "pre")
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .or(`home_team_id.in.(${list}),away_team_id.in.(${list})`)
    .order("starts_at")
    .limit(100);
  if (error) throw error;
  return (data ?? []) as GameRow[];
}

/** Display names for feed team ids: Walkoff's own list first, then the
 *  teams the engine has seen (opponents outside the V1 leagues). */
export async function teamNames(db: SupabaseClient, ids: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const id of new Set(ids.filter((x): x is string => !!x))) {
    const t = teamFromFeedId(id);
    if (t) out.set(id, t.team.name);
    else missing.push(id);
  }
  if (missing.length) {
    const { data, error } = await db.from("teams").select("id, display_name").in("id", missing);
    if (error) throw error;
    for (const r of data ?? []) out.set(r.id as string, r.display_name as string);
  }
  return out;
}

const TYPE_NAME = new Map(TRIGGERS.map((t) => [t.id, t.name]));
export const typeName = (type: string) => TYPE_NAME.get(type) ?? type;

/** A moment as the tools show it. Headlines name teams: they're for the
 *  marketer, never for campaign copy. */
export function momentView(m: MomentRow, names: Map<string, string>, game?: GameRow) {
  const team = teamFromFeedId(m.team_id);
  const status = typeof m.detail?.status === "string" ? m.detail.status : null;
  return {
    id: m.id,
    type: m.type,
    type_name: typeName(m.type),
    phase: m.phase,
    headline: m.headline,
    intensity: m.intensity,
    occurred_at: m.occurred_at,
    team: team?.team.name ?? (m.team_id ? names.get(m.team_id) : null) ?? m.team_id,
    team_key: team?.key ?? null,
    league: m.league,
    opponent: m.opponent_team_id ? (names.get(m.opponent_team_id) ?? m.opponent_team_id) : null,
    game_status: status,
    game_starts_at: game?.starts_at ?? null,
  };
}

// ── Triggers and the send log ──────────────────────────────────────

export interface TriggerRow {
  id: string;
  name: string;
  moment_types: string[];
  team_keys: string[];
  min_intensity: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

const TRIGGER_COLUMNS = "id, name, moment_types, team_keys, min_intensity, active, created_by, created_at";

export async function listTriggers(db: SupabaseClient, brandId: string): Promise<TriggerRow[]> {
  const { data, error } = await db.from("triggers").select(TRIGGER_COLUMNS).eq("brand_id", brandId).order("created_at");
  if (error) throw error;
  return (data ?? []) as TriggerRow[];
}

export async function createTrigger(
  db: SupabaseClient,
  brandId: string,
  t: { name: string; moment_types: string[]; team_keys: string[]; min_intensity: number; created_by: string },
): Promise<TriggerRow> {
  const { data, error } = await db
    .from("triggers")
    .insert({ brand_id: brandId, ...t })
    .select(TRIGGER_COLUMNS)
    .single();
  if (error) throw error;
  return data as TriggerRow;
}

/** Deletes one of the brand's triggers. False when it isn't the brand's. */
export async function deleteTrigger(db: SupabaseClient, brandId: string, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { data, error } = await db.from("triggers").delete().eq("brand_id", brandId).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export interface SendRow {
  id: string;
  moment_id: string;
  trigger_id: string | null;
  status: "drafted" | "sent" | "skipped";
  channel: string;
  campaign_ref: string | null;
  audience_size: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const SEND_COLUMNS = "id, moment_id, trigger_id, status, channel, campaign_ref, audience_size, notes, created_by, created_at";

export async function sendsFor(db: SupabaseClient, brandId: string, opts: { momentIds?: string[]; since?: Date } = {}): Promise<SendRow[]> {
  if (opts.momentIds && !opts.momentIds.length) return [];
  let q = db.from("sends").select(SEND_COLUMNS).eq("brand_id", brandId).order("created_at", { ascending: false }).limit(500);
  if (opts.momentIds) q = q.in("moment_id", opts.momentIds);
  if (opts.since) q = q.gte("created_at", opts.since.toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SendRow[];
}

/** The latest thing the brand did with each moment. */
export function latestByMoment(sends: SendRow[]): Map<string, SendRow> {
  const out = new Map<string, SendRow>();
  for (const s of sends) {
    const prev = out.get(s.moment_id);
    if (!prev || s.created_at > prev.created_at) out.set(s.moment_id, s);
  }
  return out;
}

export async function logSend(
  db: SupabaseClient,
  row: Omit<SendRow, "id" | "created_at" | "channel"> & { brand_id: string; channel?: string },
): Promise<SendRow> {
  const { data, error } = await db.from("sends").insert(row).select(SEND_COLUMNS).single();
  if (error) throw error;
  return data as SendRow;
}

/** Every V1 team key, for checking trigger teams. */
export const ALL_TEAM_KEYS = new Set(Object.entries(TEAM_HOMES).flatMap(([league, teams]) => teams.map((t) => `${league}:${t.id}`)));
