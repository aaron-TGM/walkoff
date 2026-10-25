// Hometown moments for a brand (lib/hometown): the recent ones in towns
// near its customers, how many of them each town's circle likely holds,
// and which make the brand's queue. Server-only: it reads lib/places.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AreaCount } from "../affinity/compute";
import { territory } from "../affinity/territories";
import { HOMETOWN_TYPES, isHometownType, type HometownDetail } from "../hometown/derive";
import { placeByKey, townCircle, townCustomers, townLift, type Place, type TownCircle } from "../places";
import { ATHLETE_COPY_RULE, sourceWords } from "./athlete-tools";
import { REACH } from "./audience";
import { has009, momentColumns, typeName, type MomentRow } from "./data";
import { LOCAL, matchingRule, momentWindow, type LocalFit, type MomentWindow, type QueueMoment, type TriggerRule } from "./queue";
import { teamFromFeedId } from "./teams";

/** Recent hometown moments, not retracted, newest first. None before
 *  009_athletes.sql has run. */
export async function hometownMoments(db: SupabaseClient, opts: { since: Date; types?: string[]; limit?: number }): Promise<MomentRow[]> {
  if (!(await has009(db))) return [];
  const types = opts.types?.length ? opts.types.filter(isHometownType) : [...HOMETOWN_TYPES];
  if (!types.length) return [];
  const { data, error } = await db
    .from("moments")
    .select(await momentColumns(db))
    .not("place_key", "is", null)
    .is("retracted_at", null)
    .in("type", types)
    .gte("detected_at", opts.since.toISOString())
    .order("detected_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (error) throw error;
  return (data ?? []) as unknown as MomentRow[];
}

const detailOf = (m: MomentRow) => m.detail as unknown as HometownDetail;

export interface TownFit extends LocalFit {
  place: Place;
  circle: TownCircle;
}

/** The brand's customers in each moment's town, by place key, in the
 *  circle the moment was made with. */
export async function townFits(moments: MomentRow[], counts: AreaCount[]): Promise<Map<string, TownFit>> {
  const out = new Map<string, TownFit>();
  const countries = new Set(counts.filter((c) => c.customers > 0).map((c) => c.country));
  for (const m of moments) {
    const key = m.place_key;
    if (!key || out.has(key)) continue;
    const place = await placeByKey(key);
    if (!place || !countries.has(place.country)) continue;
    const radius = detailOf(m).town?.radius_miles;
    const circle = await townCircle(place, radius ? { radiusMiles: radius } : {});
    out.set(key, { placeKey: key, lat: place.lat, lng: place.lng, customers: townCustomers(circle, counts), lift: townLift(circle, counts), place, circle });
  }
  return out;
}

/** Where the towns a brand's rules name are, for matching nearby ones. */
export async function ruleTowns(rules: TriggerRule[]): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>();
  for (const key of new Set(rules.flatMap((r) => r.place_keys ?? []))) {
    const p = await placeByKey(key);
    if (p) out.set(key, { lat: p.lat, lng: p.lng });
  }
  return out;
}

/** Whether a town is in a team's core territory, where most fans follow the
 *  team: its own title moment already reaches them. */
export function inTeamCore(teamKey: string, place: Place): boolean {
  const [league, id] = teamKey.split(":");
  const code = place.country === "GB" ? place.ref.split(" ")[0] : place.ref.slice(0, 3);
  const shares = territory(league).byArea.get(`${place.country}:${code}`) ?? [];
  return (shares.find((s) => s.team.id === id)?.share ?? 0) >= REACH.core;
}

export interface LocalItem {
  row: MomentRow;
  fit: TownFit;
  rule: TriggerRule;
  window: MomentWindow;
}

const queueMoment = (m: MomentRow, fit: TownFit | null): QueueMoment => ({
  type: m.type,
  intensity: m.intensity,
  occurredAt: new Date(m.occurred_at),
  gameStart: typeof m.detail?.startsAt === "string" ? new Date(m.detail.startsAt) : null,
  teamKey: teamFromFeedId(m.team_id)?.key ?? null,
  local: fit,
});

/** The hometown moments that make a brand's queue: matched by a rule, still
 *  open, at most LOCAL.townsPerEvent towns per event (the most customers
 *  first). A town in the champion's core territory is left out when the
 *  brand's queue has the team's own title (titleGames), so nobody there
 *  gets two sends. also lists, per event, the towns that didn't fit. */
export function localQueue(
  rows: MomentRow[],
  fits: Map<string, TownFit>,
  opts: { rules: TriggerRule[]; standouts: string[]; towns: Map<string, { lat: number; lng: number }>; titleGames: Set<string>; now: Date },
): { items: LocalItem[]; also: { event: string; towns: string[] }[]; inTeamTerritory: number } {
  const matched: LocalItem[] = [];
  let inTeamTerritory = 0;
  for (const row of rows) {
    const fit = row.place_key ? fits.get(row.place_key) : undefined;
    if (!fit) continue;
    const qm = queueMoment(row, fit);
    const rule = matchingRule(qm, opts.rules, opts.standouts, opts.towns);
    const window = momentWindow(qm, opts.now);
    if (!rule || window.status === "closed") continue;
    if (row.game_id && opts.titleGames.has(row.game_id) && qm.teamKey && inTeamCore(qm.teamKey, fit.place)) {
      inTeamTerritory++;
      continue;
    }
    matched.push({ row, fit, rule, window });
  }
  const byEvent = new Map<string, LocalItem[]>();
  for (const item of matched) {
    const key = detailOf(item.row).event?.key ?? item.row.id;
    byEvent.set(key, [...(byEvent.get(key) ?? []), item]);
  }
  const items: LocalItem[] = [];
  const also: { event: string; towns: string[] }[] = [];
  for (const group of byEvent.values()) {
    group.sort((a, b) => b.fit.customers - a.fit.customers || b.row.intensity - a.row.intensity);
    items.push(...group.slice(0, LOCAL.townsPerEvent));
    const rest = group.slice(LOCAL.townsPerEvent);
    if (rest.length) also.push({ event: detailOf(group[0].row).event?.name ?? group[0].row.headline, towns: rest.map((x) => detailOf(x.row).town?.label ?? x.fit.place.name) });
  }
  return { items, also, inTeamTerritory };
}

const ROLE_WORDS: Record<string, string> = {
  leader: "led the team",
  played: "played",
  roster: "on the roster",
  reserve: "on the roster as a reserve",
};

/** A hometown moment as the tools show it. The athletes are for the
 *  marketer; campaign copy never names them without written rights. */
export function hometownView(m: MomentRow, fit: TownFit | undefined) {
  const d = detailOf(m);
  const champion = teamFromFeedId(m.team_id)?.team.name ?? d.team?.name ?? null;
  return {
    id: m.id,
    type: m.type,
    type_name: typeName(m.type),
    phase: m.phase,
    headline: m.headline,
    intensity: m.intensity,
    occurred_at: m.occurred_at,
    town: d.town?.label ?? null,
    circle: d.town ? `${fit?.circle.radiusMiles ?? d.town.radius_miles} miles around ${d.town.ref}` : null,
    ...(fit ? { customers_estimate: fit.customers, lift: fit.lift } : {}),
    event: d.event?.name ?? null,
    team: champion,
    league: m.league,
    athletes: (d.athletes ?? []).map((a) => ({
      name: a.name,
      id: a.id,
      position: a.position,
      part: `${ROLE_WORDS[a.role] ?? a.role}${a.led?.length ? ` (${a.led.join(", ")})` : ""}`,
      how_walkoff_knows: a.from.map(sourceWords),
      sure: a.sure,
    })),
    copy_rule: ATHLETE_COPY_RULE,
  };
}
