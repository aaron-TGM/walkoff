// Athletes, where they're from, what they won and the brands that may name
// them (supabase/009_athletes.sql). Until that migration has run there are
// no tables: reads come back empty, and athletesReady says so. Check it
// before writing: PostgREST answers a write to a missing table with a bare
// 404, nothing that says why.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Country } from "../affinity/geo";
import { nameKey } from "../places/names";
import { isMissingSchema } from "../supabase";
import { sourceConfidence, type AthletePlace, type PlaceKind, type PlaceSource, type Resolution } from "./homes";

export interface Athlete {
  /** "espn:football:3912547". */
  id: string;
  sport: string;
  league: string | null;
  externalId: string;
  /** For operators and marketers. Never in campaign copy. */
  displayName: string;
  teamId: string | null;
  position: string | null;
  jersey: string | null;
  rosterStatus: "active" | "reserve" | null;
  college: string | null;
}

export type ResultKind = "title" | "win" | "lead";
/** leader: led the team in the title game, or won alone. */
export type ResultRole = "leader" | "played" | "roster" | "reserve";

export interface AthleteResult {
  athleteId: string;
  /** "espn:nfl:401772988". */
  eventKey: string;
  /** "Super Bowl LX", for the marketer's eyes only. */
  eventName: string;
  kind: ResultKind;
  role: ResultRole;
  teamId: string | null;
  momentId: string | null;
  intensity: number;
  occurredAt: string;
  createdBy: string;
}

export interface AthleteRight {
  id: string;
  brandId: string;
  athleteId: string;
  startsOn: string;
  endsOn: string;
  /** Where the agreement is: a contract id or link. */
  evidence: string;
  recordedBy: string;
}

/** ESPN keeps one id for an athlete across a sport, college to the pros. */
export function athleteId(sport: string, externalId: string): string {
  return `espn:${sport}:${externalId}`;
}

/** Ids per request, to keep the URLs short. */
const CHUNK = 100;

/** Rows for a list of ids, a chunk at a time. Empty before 009 has run. */
async function byIds<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await read(ids.slice(i, i + CHUNK));
    if (error) {
      if (isMissingSchema(error)) return [];
      throw error;
    }
    out.push(...((data as T[]) ?? []));
  }
  return out;
}

/** Whether 009_athletes.sql has run. */
export async function athletesReady(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("athletes").select("id").limit(1);
  if (error && !isMissingSchema(error)) throw error;
  return !error;
}

/** Adds athletes, or updates what a roster says about them. */
export async function saveAthletes(db: SupabaseClient, athletes: Athlete[], checkedAt = new Date().toISOString()): Promise<void> {
  for (let i = 0; i < athletes.length; i += 500) {
    const rows = athletes.slice(i, i + 500).map((a) => ({
      id: a.id,
      sport: a.sport,
      league: a.league,
      external_id: a.externalId,
      display_name: a.displayName,
      name_key: nameKey(a.displayName),
      team_id: a.teamId,
      position: a.position,
      jersey: a.jersey,
      roster_status: a.rosterStatus,
      college: a.college,
      roster_checked_at: checkedAt,
      updated_at: checkedAt,
    }));
    const { error } = await db.from("athletes").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}

type AthleteRow = {
  id: string;
  sport: string;
  league: string | null;
  external_id: string;
  display_name: string;
  team_id: string | null;
  position: string | null;
  jersey: string | null;
  roster_status: Athlete["rosterStatus"];
  college: string | null;
};

export async function loadAthletes(db: SupabaseClient, ids: string[]): Promise<Athlete[]> {
  const rows = await byIds<AthleteRow>(ids, (chunk) =>
    db.from("athletes").select("id, sport, league, external_id, display_name, team_id, position, jersey, roster_status, college").in("id", chunk),
  );
  return rows.map((r) => ({
    id: r.id,
    sport: r.sport,
    league: r.league,
    externalId: r.external_id,
    displayName: r.display_name,
    teamId: r.team_id,
    position: r.position,
    jersey: r.jersey,
    rosterStatus: r.roster_status,
    college: r.college,
  }));
}

/** Saves each source's word on where athletes are from, replacing what the
 *  same source said before. updatedBy is "engine" or the operator's email. */
export async function savePlaces(db: SupabaseClient, places: AthletePlace[], updatedBy = "engine"): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < places.length; i += 500) {
    const rows = places.slice(i, i + 500).map((p) => ({
      athlete_id: p.athleteId,
      kind: p.kind,
      source: p.source,
      raw: p.raw,
      resolution: p.resolution,
      place_key: p.placeKey,
      place_name: p.placeName,
      region: p.region,
      country: p.country,
      lat: p.lat,
      lng: p.lng,
      ref_code: p.refCode,
      area: p.area,
      confidence: sourceConfidence(p.kind, p.source),
      active: p.active,
      note: p.note,
      updated_by: updatedBy,
      updated_at: now,
    }));
    const { error } = await db.from("athlete_places").upsert(rows, { onConflict: "athlete_id,kind,source" });
    if (error) throw error;
  }
}

type PlaceRow = {
  athlete_id: string;
  kind: PlaceKind;
  source: PlaceSource;
  raw: string;
  resolution: Resolution;
  place_key: string | null;
  place_name: string | null;
  region: string | null;
  country: Country | null;
  lat: number | null;
  lng: number | null;
  ref_code: string | null;
  area: string | null;
  active: boolean;
  note: string | null;
};

/** What every source says about where these athletes are from. */
export async function placesOf(db: SupabaseClient, athleteIds: string[]): Promise<AthletePlace[]> {
  const rows = await byIds<PlaceRow>(athleteIds, (chunk) =>
    db
      .from("athlete_places")
      .select("athlete_id, kind, source, raw, resolution, place_key, place_name, region, country, lat, lng, ref_code, area, active, note")
      .in("athlete_id", chunk),
  );
  return rows.map((r) => ({
    athleteId: r.athlete_id,
    kind: r.kind,
    source: r.source,
    raw: r.raw,
    resolution: r.resolution,
    placeKey: r.place_key,
    placeName: r.place_name,
    region: r.region,
    country: r.country,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    refCode: r.ref_code,
    area: r.area,
    active: r.active,
    note: r.note,
  }));
}

/** Records who won what. A result already on file stays as it is; returns
 *  how many were new. */
export async function saveResults(db: SupabaseClient, results: AthleteResult[]): Promise<number> {
  let added = 0;
  for (let i = 0; i < results.length; i += 500) {
    const rows = results.slice(i, i + 500).map((r) => ({
      athlete_id: r.athleteId,
      event_key: r.eventKey,
      event_name: r.eventName,
      kind: r.kind,
      role: r.role,
      team_id: r.teamId,
      moment_id: r.momentId,
      intensity: r.intensity,
      occurred_at: r.occurredAt,
      created_by: r.createdBy,
    }));
    const { data, error } = await db
      .from("athlete_results")
      .upsert(rows, { onConflict: "event_key,athlete_id,kind", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    added += (data as unknown[] | null)?.length ?? 0;
  }
  return added;
}

/** The athletes a brand may name today: a written agreement on file, in
 *  date and not revoked. */
export async function namingRights(
  db: SupabaseClient,
  brandId: string,
  athleteIds: string[],
  today = new Date().toISOString().slice(0, 10),
): Promise<Map<string, AthleteRight>> {
  const rows = await byIds<{
    id: string;
    athlete_id: string;
    starts_on: string;
    ends_on: string;
    evidence: string;
    recorded_by: string;
  }>(athleteIds, (chunk) =>
    db
      .from("brand_athlete_rights")
      .select("id, athlete_id, starts_on, ends_on, evidence, recorded_by")
      .eq("brand_id", brandId)
      .eq("may_name", true)
      .is("revoked_at", null)
      .in("athlete_id", chunk),
  );
  const out = new Map<string, AthleteRight>();
  for (const r of rows) {
    if (r.starts_on > today || r.ends_on < today) continue;
    out.set(r.athlete_id, {
      id: r.id,
      brandId,
      athleteId: r.athlete_id,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      evidence: r.evidence,
      recordedBy: r.recorded_by,
    });
  }
  return out;
}
