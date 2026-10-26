// Keeps athletes and where they're from up to date: every team's roster
// once a day, where ESPN says each player was born, high schools and
// birthplaces from Wikidata, and the hometowns in data/athletes/curated.json.
// Once 010_player_moments.sql has run, it also notes who moved teams and
// how well known each player is, and a star's move makes a big_signing
// moment for the new team (signings.ts). A little work each tick, with
// progress saved, so a restart picks up where it stopped. See
// engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEAM_HOMES } from "../../lib/affinity/geo";
import {
  athleteId,
  athletePlace,
  athletesReady,
  CURATED_HOMES,
  curatedPlace,
  has010,
  loadAthletes,
  optedOut,
  placesOf,
  saveAthletes,
  savePlaces,
  type Athlete,
  type AthletePlace,
} from "../../lib/athletes";
import { LEAGUES } from "../../lib/leagues";
import { nearestPlace, resolvePlace, type Resolved } from "../../lib/places";
import { errorMessage, log } from "../log";
import { birthPlaceText, type AthleteFeed, type RosterPlayer } from "./feed";
import { FAME, fameRank, signingRow, type Mover } from "./signings";
import { ESPN_PROPERTIES, locatePlace, WikidataBusy, type WikidataClient, type WikidataPlace } from "./wikidata";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const SYNC = {
  /** Between ticks while there's work. */
  busy: MINUTE,
  /** Nothing due. */
  idle: 15 * MINUTE,
  /** Until 009_athletes.sql has run. */
  noTables: HOUR,
  error: 5 * MINUTE,
  teamsPerTick: 2,
  /** A team's roster is read again after this. */
  rosterAge: 24 * HOUR,
  /** A team whose roster failed waits this long per failure in a row, up
   *  to a day. */
  failureWait: HOUR,
  /** Athletes per Wikidata request, at most one request a tick. */
  wikidataBatch: 200,
  /** An athlete is looked up again after this. */
  wikidataAge: 30 * 24 * HOUR,
  /** With no one due, the next look for some. */
  wikidataIdle: HOUR,
  /** When Wikidata says it's busy: at least this long, doubling each time
   *  in a row, up to 4 hours. */
  wikidataWait: 15 * MINUTE,
  wikidataMaxWait: 4 * HOUR,
  curatedEvery: HOUR,
};

interface Team {
  /** "espn:nfl:26". */
  id: string;
  league: string;
  sport: string;
  feedPath: string;
  externalId: string;
  name: string;
  abbr: string;
  location: string;
  nickname: string;
}

/** The teams Walkoff has homes for (data/geo/team-homes.json), in the
 *  leagues the engine follows. */
export function teamsFor(leagues: string[]): Team[] {
  return LEAGUES.filter((l) => leagues.includes(l.id)).flatMap((l) =>
    (TEAM_HOMES[l.id] ?? []).map((t) => ({
      id: `espn:${l.id}:${t.id}`,
      league: l.id,
      sport: l.feedPath.split("/")[0],
      feedPath: l.feedPath,
      externalId: t.id,
      name: t.name,
      abbr: t.abbr,
      location: t.location,
      nickname: t.nickname,
    })),
  );
}

interface SyncRow {
  team_id: string;
  synced_at: string | null;
  failures: number;
  updated_at: string;
}

type AthleteRow = { id: string; sport: string; external_id: string; display_name: string; name_key: string };

/** Where an athlete was before a roster read: their team, or the one they
 *  left. */
type Before = { team_id: string | null; previous_team_id: string | null };

export interface AthleteSyncOptions {
  leagues: string[];
  /** Null when WIKIDATA=0. */
  wikidata: WikidataClient | null;
  /** Make big_signing moments (SIGNINGS=0 turns them off). Default on. */
  signings?: boolean;
  now?: () => number;
  /** lib/places, unless a test swaps them. */
  resolve?: (b: { city: string; state: string; country: string }) => Promise<Resolved>;
  locate?: typeof nearestPlace;
}

export class AthleteSync {
  private readonly teams: Team[];
  private readonly now: () => number;
  private wikidataNext = 0;
  private wikidataWait = SYNC.wikidataWait;
  private curatedAt = -Infinity;
  private failures = 0;
  private waiting = false;
  private after010 = false;
  /** Moves this run has judged already, as moments' dedupe keys. */
  private readonly judged = new Set<string>();

  constructor(
    private readonly db: SupabaseClient,
    private readonly feed: AthleteFeed,
    private readonly options: AthleteSyncOptions,
  ) {
    this.teams = teamsFor(options.leagues);
    this.now = options.now ?? Date.now;
  }

  /** Does the work that's due and says how long to wait before the next tick. */
  async tick(): Promise<number> {
    const started = this.now();
    try {
      if (!(await athletesReady(this.db))) {
        if (!this.waiting) log("WARNING", "Athlete sync is waiting for supabase/009_athletes.sql to run");
        this.waiting = true;
        return SYNC.noTables;
      }
      this.waiting = false;
      const teams = await this.syncTeams();
      const asked = await this.askWikidata();
      await this.syncCurated();
      await this.bigSignings();
      this.failures = 0;
      await this.heartbeat(started, teams.fresh, null);
      return teams.synced > 0 || asked > 0 ? SYNC.busy : SYNC.idle;
    } catch (e) {
      this.failures++;
      log("ERROR", "Athlete sync failed", { error: errorMessage(e) });
      await this.heartbeat(started, null, errorMessage(e)).catch(() => {});
      return SYNC.error;
    }
  }

  /** Reads a team's roster now unless it's newer than maxAge, or the team
   *  is waiting out failures. For a champion: the hometown job wants the
   *  roster as it stood on the day. */
  async refreshTeam(teamId: string, maxAge: number): Promise<"fresh" | "synced" | "failed" | "unknown"> {
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return "unknown";
    const { data, error } = await this.db
      .from("roster_syncs")
      .select("team_id, synced_at, failures, updated_at")
      .eq("team_id", teamId)
      .maybeSingle();
    if (error) throw error;
    const row = (data as SyncRow | null) ?? undefined;
    if (row?.synced_at && this.now() - Date.parse(row.synced_at) < maxAge) return "fresh";
    if (row && row.failures > 0 && !this.due(row)) return "failed";
    return (await this.syncTeam(team, row)) ? "synced" : "failed";
  }

  /** Whether 010_player_moments.sql has run: moves and fame are kept. */
  private async moves(): Promise<boolean> {
    if (!this.after010) this.after010 = await has010(this.db);
    return this.after010;
  }

  // ── Rosters ──────────────────────────────────────────────────────

  private due(row: SyncRow | undefined): boolean {
    if (!row) return true;
    const now = this.now();
    if (row.failures > 0) return now - Date.parse(row.updated_at) >= Math.min(row.failures * SYNC.failureWait, SYNC.rosterAge);
    return !row.synced_at || now - Date.parse(row.synced_at) >= SYNC.rosterAge;
  }

  /** The teams synced longest ago, never-synced ones first. */
  private async syncTeams(): Promise<{ synced: number; fresh: number }> {
    const { data, error } = await this.db.from("roster_syncs").select("team_id, synced_at, failures, updated_at");
    if (error) throw error;
    const rows = new Map(((data ?? []) as SyncRow[]).map((r) => [r.team_id, r]));
    const age = (t: Team) => {
      const at = rows.get(t.id)?.synced_at;
      return at ? Date.parse(at) : -Infinity;
    };
    const due = this.teams.filter((t) => this.due(rows.get(t.id))).sort((a, b) => age(a) - age(b));
    let synced = 0;
    for (const team of due.slice(0, SYNC.teamsPerTick)) if (await this.syncTeam(team, rows.get(team.id))) synced++;
    const fresh = this.teams.filter((t) => this.now() - age(t) < SYNC.rosterAge).length + synced;
    return { synced, fresh };
  }

  private async syncTeam(team: Team, row: SyncRow | undefined): Promise<boolean> {
    const at = new Date(this.now()).toISOString();
    // A team row for the foreign keys, if the poller hasn't seen the team
    // yet. An existing row, and its colors, stay as they are.
    const { error: teamError } = await this.db.from("teams").upsert(
      [
        {
          id: team.id,
          league: team.league,
          external_id: team.externalId,
          abbreviation: team.abbr || null,
          display_name: team.name,
          short_name: team.nickname || null,
          location: team.location || null,
        },
      ],
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (teamError) throw teamError;
    let players: RosterPlayer[];
    try {
      players = await this.feed.roster(team.feedPath, team.externalId);
      // An empty roster is ESPN having a bad moment, not a team with no one
      // on it: clearing everyone would be wrong.
      if (players.length === 0) throw new Error("ESPN sent an empty roster");
    } catch (e) {
      await this.saveSync({ team_id: team.id, league: team.league, failures: (row?.failures ?? 0) + 1, last_error: errorMessage(e), updated_at: at });
      log("WARNING", "Roster sync failed", { team: team.name, error: errorMessage(e) });
      return false;
    }
    const athletes = players.map((p): Athlete => ({
      id: athleteId(team.sport, p.externalId),
      sport: team.sport,
      league: team.league,
      externalId: p.externalId,
      displayName: p.displayName,
      teamId: team.id,
      position: p.position,
      jersey: p.jersey,
      rosterStatus: p.reserve ? "reserve" : "active",
      college: p.college,
    }));
    const moves = await this.moves();
    const before = moves ? await this.whereBefore(athletes.map((a) => a.id)) : new Map<string, Before>();
    await saveAthletes(this.db, athletes, at);
    const left = await this.clearDeparted(team.id, new Set(athletes.map((a) => a.id)), moves);
    const joined = moves ? await this.noteJoins(team.id, athletes, before, at) : 0;
    const placed = await this.saveBirthplaces(team, players);
    await this.saveSync({ team_id: team.id, league: team.league, synced_at: at, athletes: athletes.length, failures: 0, last_error: null, updated_at: at });
    log("INFO", "Synced roster", { team: team.name, players: athletes.length, reserve: players.filter((p) => p.reserve).length, left, joined, birthplaces: placed });
    return true;
  }

  private async whereBefore(ids: string[]): Promise<Map<string, Before>> {
    const out = new Map<string, Before>();
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await this.db.from("athletes").select("id, team_id, previous_team_id").in("id", ids.slice(i, i + 100));
      if (error) throw error;
      for (const r of (data ?? []) as ({ id: string } & Before)[]) out.set(r.id, { team_id: r.team_id, previous_team_id: r.previous_team_id });
    }
    return out;
  }

  /** Athletes Walkoff knew on another team, now on this one: when they
   *  joined, and the team they left. Someone new to Walkoff, or back on the
   *  team they left, hasn't moved. */
  private async noteJoins(teamId: string, athletes: Athlete[], before: Map<string, Before>, at: string): Promise<number> {
    const from = new Map<string, string[]>();
    for (const a of athletes) {
      const b = before.get(a.id);
      const left = b?.team_id ?? b?.previous_team_id;
      if (!left || left === teamId) continue;
      from.set(left, [...(from.get(left) ?? []), a.id]);
    }
    for (const [left, ids] of from) {
      const { error } = await this.db.from("athletes").update({ previous_team_id: left, joined_at: at }).in("id", ids);
      if (error) throw error;
    }
    return [...from.values()].reduce((n, ids) => n + ids.length, 0);
  }

  private async saveSync(row: Record<string, unknown>): Promise<void> {
    const { error } = await this.db.from("roster_syncs").upsert(row, { onConflict: "team_id" });
    if (error) throw error;
  }

  /** Players the team no longer lists, until their next team's sync. With
   *  010 run, the team they left is kept, for when they join another. */
  private async clearDeparted(teamId: string, keep: Set<string>, moves: boolean): Promise<number> {
    const { data, error } = await this.db.from("athletes").select("id").eq("team_id", teamId);
    if (error) throw error;
    const gone = ((data ?? []) as { id: string }[]).map((r) => r.id).filter((id) => !keep.has(id));
    for (let i = 0; i < gone.length; i += 100) {
      const { error: e } = await this.db
        .from("athletes")
        .update({ team_id: null, roster_status: null, updated_at: new Date(this.now()).toISOString(), ...(moves ? { previous_team_id: teamId } : {}) })
        .in("id", gone.slice(i, i + 100));
      if (e) throw e;
    }
    return gone.length;
  }

  /** Where ESPN says each player was born, found only when ESPN's text has
   *  changed since the last sync. */
  private async saveBirthplaces(team: Team, players: RosterPlayer[]): Promise<number> {
    const ids = players.map((p) => athleteId(team.sport, p.externalId));
    const before = new Map(
      (await placesOf(this.db, ids)).filter((p) => p.kind === "birthplace" && p.source === "espn").map((p) => [p.athleteId, p.raw]),
    );
    const resolve = this.options.resolve ?? resolvePlace;
    const rows: AthletePlace[] = [];
    for (const p of players) {
      if (!p.birthPlace) continue;
      const id = athleteId(team.sport, p.externalId);
      const raw = birthPlaceText(p.birthPlace);
      if (before.get(id) === raw) continue;
      rows.push(athletePlace(id, "birthplace", "espn", raw, await resolve(p.birthPlace)));
    }
    await savePlaces(this.db, rows);
    return rows.length;
  }

  // ── Big signings ─────────────────────────────────────────────────

  /** A big_signing moment for each star who joined a team lately, once:
   *  the moments table skips a repeat. */
  private async bigSignings(): Promise<number> {
    if (this.options.signings === false || !(await this.moves())) return 0;
    const since = new Date(this.now() - FAME.window).toISOString();
    const { data, error } = await this.db
      .from("athletes")
      .select("id, league, display_name, position, team_id, previous_team_id, joined_at, sitelinks")
      .gte("joined_at", since)
      .gte("sitelinks", FAME.min)
      .not("team_id", "is", null);
    if (error) throw error;
    const key = (m: Mover) => `big_signing:${m.id}:${m.team_id}`;
    const fresh = ((data ?? []) as Mover[]).filter((m) => !this.judged.has(key(m)));
    // Nobody who asked Walkoff to stop using them (011_athlete_opt_outs.sql).
    const out = await optedOut(this.db, fresh.map((m) => m.id));
    const rows = [];
    for (const m of fresh.filter((m) => !out.has(m.id))) {
      const rank = await fameRank(this.db, m);
      if (rank < FAME.top) rows.push({ m, rank });
    }
    const saved = rows.length ? await this.saveSignings(rows) : 0;
    for (const m of fresh) this.judged.add(key(m));
    return saved;
  }

  private async saveSignings(rows: { m: Mover; rank: number }[]): Promise<number> {
    const teamIds = [...new Set(rows.flatMap(({ m }) => [m.team_id, m.previous_team_id].filter((t): t is string => !!t)))];
    const { data: teamRows, error: teamError } = await this.db.from("teams").select("id, display_name").in("id", teamIds);
    if (teamError) throw teamError;
    const names = new Map(((teamRows ?? []) as { id: string; display_name: string }[]).map((t) => [t.id, t.display_name]));
    const { data: saved, error: e } = await this.db
      .from("moments")
      .upsert(
        rows.map(({ m, rank }) => signingRow(m, rank, names)),
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("headline");
    if (e) throw e;
    for (const r of (saved ?? []) as { headline: string }[]) log("INFO", r.headline, { moment: "big_signing" });
    return saved?.length ?? 0;
  }

  // ── Wikidata ─────────────────────────────────────────────────────

  /** Up to a batch of athletes from one league that Wikidata hasn't been
   *  asked about, or not lately. Once 010 has run, those it found before
   *  without counting their pages go next. */
  private async wikidataDue(): Promise<{ league: string; rows: AthleteRow[] } | null> {
    const cutoff = this.now() - SYNC.wikidataAge;
    const moves = await this.moves();
    for (const league of this.options.leagues.filter((l) => ESPN_PROPERTIES[l])) {
      const never = await this.db
        .from("athletes")
        .select("id, sport, external_id, display_name, name_key")
        .eq("league", league)
        .is("wikidata_checked_at", null)
        .limit(SYNC.wikidataBatch);
      if (never.error) throw never.error;
      if (never.data?.length) return { league, rows: never.data as AthleteRow[] };
      if (moves) {
        const uncounted = await this.db
          .from("athletes")
          .select("id, sport, external_id, display_name, name_key")
          .eq("league", league)
          .not("wikidata_id", "is", null)
          .is("sitelinks", null)
          .limit(SYNC.wikidataBatch);
        if (uncounted.error) throw uncounted.error;
        if (uncounted.data?.length) return { league, rows: uncounted.data as AthleteRow[] };
      }
      const old = await this.db
        .from("athletes")
        .select("id, sport, external_id, display_name, name_key, wikidata_checked_at")
        .eq("league", league)
        .order("wikidata_checked_at", { ascending: true })
        .limit(SYNC.wikidataBatch);
      if (old.error) throw old.error;
      const stale = ((old.data ?? []) as (AthleteRow & { wikidata_checked_at: string | null })[]).filter(
        (r) => r.wikidata_checked_at && Date.parse(r.wikidata_checked_at) < cutoff,
      );
      if (stale.length) return { league, rows: stale };
    }
    return null;
  }

  private async askWikidata(): Promise<number> {
    const wikidata = this.options.wikidata;
    if (!wikidata || this.now() < this.wikidataNext) return 0;
    const batch = await this.wikidataDue();
    if (!batch) {
      this.wikidataNext = this.now() + SYNC.wikidataIdle;
      return 0;
    }
    let found;
    try {
      found = await wikidata.lookup(batch.league, batch.rows.map((r) => r.external_id));
      this.wikidataWait = SYNC.wikidataWait;
    } catch (e) {
      const asked = e instanceof WikidataBusy && e.retryAfter ? e.retryAfter * 1000 : 0;
      const wait = Math.max(this.wikidataWait, asked);
      this.wikidataNext = this.now() + wait;
      this.wikidataWait = Math.min(wait * 2, SYNC.wikidataMaxWait);
      log("WARNING", "Wikidata lookup put off", { minutes: Math.round(wait / MINUTE), error: errorMessage(e) });
      return 0;
    }
    const at = new Date(this.now()).toISOString();
    const byId = new Map(found.map((f) => [f.externalId, f]));
    const moves = await this.moves();
    const { error } = await this.db.from("athletes").upsert(
      batch.rows.map((r) => ({
        id: r.id,
        sport: r.sport,
        external_id: r.external_id,
        display_name: r.display_name,
        name_key: r.name_key,
        wikidata_id: byId.get(r.external_id)?.item ?? null,
        ...(moves ? { sitelinks: byId.get(r.external_id)?.sitelinks ?? null } : {}),
        wikidata_checked_at: at,
        updated_at: at,
      })),
      { onConflict: "id" },
    );
    if (error) throw error;
    const sportOf = new Map(batch.rows.map((r) => [r.external_id, r.sport]));
    const rows: AthletePlace[] = [];
    for (const f of found) {
      const id = athleteId(sportOf.get(f.externalId)!, f.externalId);
      if (f.school) rows.push(athletePlace(id, "high_school", "wikidata", f.school.name, await this.locate(f.school)));
      if (f.birthplace) rows.push(athletePlace(id, "birthplace", "wikidata", f.birthplace.name, await this.locate(f.birthplace)));
    }
    await savePlaces(this.db, rows);
    log("INFO", "Looked athletes up on Wikidata", {
      league: batch.league,
      asked: batch.rows.length,
      found: found.length,
      schools: found.filter((f) => f.school).length,
    });
    return batch.rows.length;
  }

  /** The town a Wikidata place is in. */
  private locate(p: WikidataPlace): Promise<Resolved> {
    return locatePlace(p, { locate: this.options.locate, resolve: this.options.resolve });
  }

  // ── The curated file ─────────────────────────────────────────────

  /** Saves curated hometowns for athletes the sync has met, and drops the
   *  ones taken out of the file. */
  private async syncCurated(): Promise<void> {
    if (this.now() - this.curatedAt < SYNC.curatedEvery) return;
    this.curatedAt = this.now();
    const ids = CURATED_HOMES.map((h) => h.athlete);
    const known = new Set((await loadAthletes(this.db, ids)).map((a) => a.id));
    const { data, error } = await this.db.from("athlete_places").select("athlete_id, raw").eq("source", "curated");
    if (error) throw error;
    const stored = new Map(((data ?? []) as { athlete_id: string; raw: string }[]).map((r) => [r.athlete_id, r.raw]));
    const rows: AthletePlace[] = [];
    for (const h of CURATED_HOMES) {
      // Not met yet: its team hasn't synced.
      if (known.has(h.athlete) && stored.get(h.athlete) !== h.hometown) rows.push(await curatedPlace(h));
    }
    await savePlaces(this.db, rows);
    const dropped = [...stored.keys()].filter((id) => !ids.includes(id));
    if (dropped.length) {
      const { error: e } = await this.db.from("athlete_places").delete().eq("source", "curated").in("athlete_id", dropped);
      if (e) throw e;
    }
    if (rows.length || dropped.length) log("INFO", "Curated hometowns", { saved: rows.length, dropped: dropped.length });
  }

  // ── Heartbeat ────────────────────────────────────────────────────

  /** One row, "athletes", in engine_heartbeats: games is the teams whose
   *  roster is under a day old. */
  private async heartbeat(started: number, fresh: number | null, error: string | null): Promise<void> {
    const at = new Date(this.now()).toISOString();
    const row: Record<string, unknown> = {
      league: "athletes",
      last_poll_at: at,
      latency_ms: this.now() - started,
      consecutive_failures: this.failures,
      updated_at: at,
    };
    if (fresh !== null) row.games = fresh;
    if (error) {
      row.last_error_at = at;
      row.last_error = error;
    } else row.last_ok_at = at;
    const { error: e } = await this.db.from("engine_heartbeats").upsert(row, { onConflict: "league" });
    if (e) throw e;
  }
}
