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

/** game_winner: decided a playoff game at the very end (010_player_moments.sql). */
export type ResultKind = "title" | "win" | "lead" | "game_winner";
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

/** A name as a slug: "Ítalo Ferreira" is "italo-ferreira". */
export const slugOf = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** An athlete ESPN doesn't know, by sport and name: surfers, and anyone an
 *  operator adds with create_moment. "walkoff:surfing:griffin-colapinto". */
export const walkoffAthleteId = (sport: string, name: string) => `walkoff:${sport}:${slugOf(name)}`;

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

/** Whether 010_player_moments.sql has run: playoff game-winners, and moves
 *  between teams. */
export async function has010(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("athletes").select("joined_at").limit(1);
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
 *  same source said before. updatedBy is "engine" or the operator's email.
 *  Never for an athlete who asked Walkoff to stop using them. */
export async function savePlaces(db: SupabaseClient, all: AthletePlace[], updatedBy = "engine"): Promise<void> {
  if (!all.length) return;
  const out = await optedOut(db, [...new Set(all.map((p) => p.athleteId))]);
  const places = all.filter((p) => !out.has(p.athleteId));
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

/** Athletes by Walkoff's id ("espn:football:3912547", or for someone ESPN
 *  doesn't know, "walkoff:surfing:griffin-colapinto") or by full name,
 *  however it's spelled ("sam darnold"). More than one shares some names. */
export async function findAthletes(db: SupabaseClient, query: string, limit = 10): Promise<Athlete[]> {
  const q = query.trim();
  if (/^espn:[a-z-]+:\d+$/.test(q) || /^walkoff:[a-z-]+:[a-z0-9-]+$/.test(q)) return loadAthletes(db, [q]);
  const key = nameKey(q);
  if (!key) return [];
  const { data, error } = await db.from("athletes").select("id").eq("name_key", key).order("id").limit(limit);
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return loadAthletes(db, ((data ?? []) as { id: string }[]).map((r) => r.id));
}

/** Athletes with a place, found and not ruled out, in any of these postal
 *  areas. */
export async function athletesInAreas(db: SupabaseClient, areas: { country: Country; area: string }[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const country of new Set(areas.map((a) => a.country))) {
    const codes = areas.filter((a) => a.country === country).map((a) => a.area);
    const rows = await byIds<{ athlete_id: string }>(codes, (chunk) =>
      db.from("athlete_places").select("athlete_id").eq("country", country).eq("resolution", "found").eq("active", true).in("area", chunk),
    );
    for (const r of rows) ids.add(r.athlete_id);
  }
  return [...ids].sort();
}

/** Takes away the hometown an operator set, so the sources decide again. */
export async function clearOperatorHome(db: SupabaseClient, athleteId: string): Promise<void> {
  const { error } = await db.from("athlete_places").delete().eq("athlete_id", athleteId).eq("kind", "hometown").eq("source", "operator");
  if (error) throw error;
}

/** Whether 011_athlete_opt_outs.sql has run: athletes can ask Walkoff to
 *  stop using them. */
export async function has011(db: SupabaseClient): Promise<boolean> {
  const { error } = await db.from("athletes").select("opted_out_at").limit(1);
  if (error && !isMissingSchema(error)) throw error;
  return !error;
}

/** Those of these athletes who asked Walkoff to stop using them, and when.
 *  None before 011 has run. */
export async function optedOut(db: SupabaseClient, athleteIds: string[]): Promise<Map<string, string>> {
  const rows = await byIds<{ id: string; opted_out_at: string }>(athleteIds, (chunk) =>
    db.from("athletes").select("id, opted_out_at").not("opted_out_at", "is", null).in("id", chunk),
  );
  return new Map(rows.map((r) => [r.id, r.opted_out_at]));
}

/** An athlete asked Walkoff to stop using them: where they're from is
 *  deleted, and savePlaces never saves it again. Returns how many places
 *  were deleted. Needs 011. */
export async function optOut(db: SupabaseClient, athleteId: string, note: string, at: string): Promise<number> {
  const { error } = await db.from("athletes").update({ opted_out_at: at, opted_out_note: note, updated_at: at }).eq("id", athleteId);
  if (error) throw error;
  const { data, error: e } = await db.from("athlete_places").delete().eq("athlete_id", athleteId).select("kind");
  if (e) throw e;
  return (data as unknown[] | null)?.length ?? 0;
}

/** The athlete asked to be used again. Their bio and Wikidata are read
 *  again, and their roster's birthplace saved at the next sync. */
export async function optIn(db: SupabaseClient, athleteId: string, at: string): Promise<void> {
  const { error } = await db
    .from("athletes")
    .update({ opted_out_at: null, opted_out_note: null, bio_checked_at: null, wikidata_checked_at: null, updated_at: at })
    .eq("id", athleteId);
  if (error) throw error;
}

export interface RightsRecord extends AthleteRight {
  revokedAt: string | null;
}

/** Every agreement on file for a brand and an athlete, revoked ones too. */
export async function rightsOn(db: SupabaseClient, brandId: string, athleteId: string): Promise<RightsRecord[]> {
  const { data, error } = await db
    .from("brand_athlete_rights")
    .select("id, starts_on, ends_on, evidence, recorded_by, revoked_at")
    .eq("brand_id", brandId)
    .eq("athlete_id", athleteId)
    .order("starts_on");
  if (error) throw error;
  return ((data ?? []) as { id: string; starts_on: string; ends_on: string; evidence: string; recorded_by: string; revoked_at: string | null }[]).map((r) => ({
    id: r.id,
    brandId,
    athleteId,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    evidence: r.evidence,
    recordedBy: r.recorded_by,
    revokedAt: r.revoked_at,
  }));
}

/** Records a written agreement that a brand may name an athlete. */
export async function recordRights(
  db: SupabaseClient,
  r: { brandId: string; athleteId: string; startsOn: string; endsOn: string; evidence: string; recordedBy: string },
): Promise<void> {
  const { error } = await db.from("brand_athlete_rights").insert({
    brand_id: r.brandId,
    athlete_id: r.athleteId,
    may_name: true,
    starts_on: r.startsOn,
    ends_on: r.endsOn,
    evidence: r.evidence,
    recorded_by: r.recordedBy,
  });
  if (error) throw error;
}

/** Revokes every agreement on file for a brand and an athlete. Returns how
 *  many there were. */
export async function revokeRights(db: SupabaseClient, brandId: string, athleteId: string, at = new Date().toISOString()): Promise<number> {
  const { data, error } = await db
    .from("brand_athlete_rights")
    .update({ revoked_at: at })
    .eq("brand_id", brandId)
    .eq("athlete_id", athleteId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw error;
  return (data as unknown[] | null)?.length ?? 0;
}

/** Moments about an athlete since a time, newest first. Empty before 009. */
export async function athleteMoments(
  db: SupabaseClient,
  athleteId: string,
  since: string,
): Promise<{ id: string; type: string; headline: string; placeKey: string | null; detectedAt: string }[]> {
  const { data, error } = await db
    .from("moments")
    .select("id, type, headline, place_key, detected_at")
    .eq("athlete_id", athleteId)
    .gte("detected_at", since)
    .order("detected_at", { ascending: false });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return ((data ?? []) as { id: string; type: string; headline: string; place_key: string | null; detected_at: string }[]).map((m) => ({
    id: m.id,
    type: m.type,
    headline: m.headline,
    placeKey: m.place_key,
    detectedAt: m.detected_at,
  }));
}

/** Everyone on a team's roster now, reserves too. */
export async function teamRoster(db: SupabaseClient, teamId: string): Promise<Athlete[]> {
  const { data, error } = await db.from("athletes").select("id").eq("team_id", teamId).order("id");
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return loadAthletes(db, ((data ?? []) as { id: string }[]).map((r) => r.id));
}

type ResultRow = {
  athlete_id: string;
  event_key: string;
  event_name: string;
  kind: ResultKind;
  role: ResultRole;
  team_id: string | null;
  moment_id: string | null;
  intensity: number;
  occurred_at: string;
  created_by: string;
};

const toResult = (r: ResultRow): AthleteResult => ({
  athleteId: r.athlete_id,
  eventKey: r.event_key,
  eventName: r.event_name,
  kind: r.kind,
  role: r.role,
  teamId: r.team_id,
  momentId: r.moment_id,
  intensity: Number(r.intensity),
  occurredAt: r.occurred_at,
  createdBy: r.created_by,
});

const RESULT_COLUMNS = "athlete_id, event_key, event_name, kind, role, team_id, moment_id, intensity, occurred_at, created_by";

/** The results recorded from each of these team moments (a title). */
export async function resultsFor(db: SupabaseClient, momentIds: string[]): Promise<Map<string, AthleteResult[]>> {
  const rows = await byIds<ResultRow>(momentIds, (chunk) => db.from("athlete_results").select(RESULT_COLUMNS).in("moment_id", chunk));
  const out = new Map<string, AthleteResult[]>();
  for (const r of rows) out.set(r.moment_id!, [...(out.get(r.moment_id!) ?? []), toResult(r)]);
  return out;
}

/** The results recorded for an event: "espn:nfl:401772988". */
export async function eventResults(db: SupabaseClient, eventKey: string): Promise<AthleteResult[]> {
  const { data, error } = await db.from("athlete_results").select(RESULT_COLUMNS).eq("event_key", eventKey);
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return ((data ?? []) as ResultRow[]).map(toResult);
}
