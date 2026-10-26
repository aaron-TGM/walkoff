// Hometown moments for team titles. When the poller saves a title, this
// job records the champion's players as athlete results (who led, who
// played, who was on the roster) and makes a moment for each town they're
// from (lib/hometown). Every tick it looks again at the last 72 hours'
// titles, so a hometown fixed or found since then gets its town's moment.
// It reads only what's saved, so a poll never waits on it. Off unless
// HOMETOWN is 1: hometown campaigns wait on counsel. See engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { athletesReady, resultsFor, saveResults, teamRoster, type AthleteResult, type ResultRole } from "../lib/athletes";
import { makeHometownMoments, ROLE_INTENSITY } from "../lib/hometown";
import type { AthleteSync } from "./athletes/sync";
import { errorMessage, log } from "./log";
import type { Heroes } from "./moments/heroes";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const HOMETOWN = {
  every: 5 * MINUTE,
  /** Until 009_athletes.sql has run. */
  noTables: HOUR,
  error: 5 * MINUTE,
  /** Titles this recent get hometown moments. */
  window: 72 * HOUR,
  /** A champion's roster older than this is read again first. */
  rosterAge: 36 * HOUR,
};

/** A title moment, as the poller saved it. */
interface TitleRow {
  id: string;
  league: string;
  game_id: string | null;
  team_id: string | null;
  opponent_team_id: string | null;
  headline: string;
  detail: { round?: unknown; heroes?: unknown } | null;
  occurred_at: string;
}

/** The heroes the poller put on a title, if they look right. */
function heroesOf(t: TitleRow): Heroes | null {
  const h = t.detail?.heroes as Partial<Heroes> | undefined;
  return h && Array.isArray(h.leaders) && Array.isArray(h.played) ? (h as Heroes) : null;
}

export interface HometownJobOptions {
  /** To read a champion's roster again first. Null with ATHLETES=0: the
   *  last roster read is used. */
  rosters: Pick<AthleteSync, "refreshTeam"> | null;
  now?: () => number;
}

export class HometownJob {
  private readonly now: () => number;
  private failures = 0;
  private waiting = false;
  /** Titles whose champion has no roster on file, so they aren't asked about
   *  again every tick. */
  private readonly noRoster = new Set<string>();

  constructor(
    private readonly db: SupabaseClient,
    private readonly options: HometownJobOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /** Does the work that's due and says how long to wait before the next tick. */
  async tick(): Promise<number> {
    const started = this.now();
    try {
      if (!(await athletesReady(this.db))) {
        if (!this.waiting) log("WARNING", "Hometown moments are waiting for supabase/009_athletes.sql to run");
        this.waiting = true;
        return HOMETOWN.noTables;
      }
      this.waiting = false;
      const titles = await this.recentTitles();
      const recorded = await resultsFor(this.db, titles.map((t) => t.id));
      let made = 0;
      for (const t of titles) {
        const results = recorded.get(t.id) ?? (this.noRoster.has(t.id) ? [] : await this.record(t));
        if (results.length) made += await this.towns(t, results);
      }
      this.failures = 0;
      await this.heartbeat(started, made, null);
      return HOMETOWN.every;
    } catch (e) {
      this.failures++;
      log("ERROR", "Hometown moments failed", { error: errorMessage(e) });
      await this.heartbeat(started, null, errorMessage(e)).catch(() => {});
      return HOMETOWN.error;
    }
  }

  private async recentTitles(): Promise<TitleRow[]> {
    const since = new Date(this.now() - HOMETOWN.window).toISOString();
    const { data, error } = await this.db
      .from("moments")
      .select("id, league, game_id, team_id, opponent_team_id, headline, detail, occurred_at")
      .eq("type", "title_won")
      .is("retracted_at", null)
      .gte("detected_at", since)
      .order("detected_at");
    if (error) throw error;
    return (data ?? []) as TitleRow[];
  }

  /** The champion's players, from its roster now, each with their part. */
  private async record(t: TitleRow): Promise<AthleteResult[]> {
    if (!t.team_id || !t.game_id) return [];
    if (this.options.rosters) {
      const r = await this.options.rosters.refreshTeam(t.team_id, HOMETOWN.rosterAge);
      if (r === "failed") log("WARNING", "Champion's roster not read again; using the last one", { title: t.headline });
    }
    const roster = await teamRoster(this.db, t.team_id);
    if (!roster.length) {
      this.noRoster.add(t.id);
      log("WARNING", "No roster on file for a champion", { title: t.headline, team: t.team_id });
      return [];
    }
    const heroes = heroesOf(t);
    const leaders = new Set(heroes?.leaders.map((l) => l.id) ?? []);
    const played = new Set(heroes?.played ?? []);
    const results = roster.map((a): AthleteResult => {
      const role: ResultRole = leaders.has(a.externalId)
        ? "leader"
        : played.has(a.externalId)
          ? "played"
          : a.rosterStatus === "reserve"
            ? "reserve"
            : "roster";
      return {
        athleteId: a.id,
        eventKey: t.game_id!,
        eventName: typeof t.detail?.round === "string" && t.detail.round ? t.detail.round : "title",
        kind: "title",
        role,
        teamId: t.team_id,
        momentId: t.id,
        intensity: ROLE_INTENSITY[role],
        occurredAt: t.occurred_at,
        createdBy: "engine",
      };
    });
    await saveResults(this.db, results);
    log("INFO", "Recorded a champion's players", {
      title: t.headline,
      players: results.length,
      leaders: results.filter((r) => r.role === "leader").length,
      played: results.filter((r) => r.role === "played").length,
      heroes: !!heroes,
    });
    return results;
  }

  /** A moment for each town the champion's players are from. Towns that
   *  have theirs already keep it. */
  private async towns(t: TitleRow, results: AthleteResult[]): Promise<number> {
    // What each leader led, by athlete id ("espn:football:3912547" from the
    // feed's "3912547").
    const why = new Map((heroesOf(t)?.leaders ?? []).map((l) => [l.id, l.why]));
    const led = new Map<string, string[]>();
    for (const r of results) {
      const w = why.get(r.athleteId.split(":").pop()!);
      if (w) led.set(r.athleteId, w);
    }
    const first = results[0];
    const { moments, saved } = await makeHometownMoments(
      this.db,
      {
        key: first.eventKey,
        name: first.eventName,
        kind: "title",
        league: t.league,
        gameId: t.game_id,
        teamId: t.team_id,
        teamName: await this.teamName(t.team_id),
        opponentTeamId: t.opponent_team_id,
        occurredAt: t.occurred_at,
      },
      results,
      led,
    );
    if (saved.length) {
      log("INFO", "Hometown moments", { title: t.headline, towns: saved.length, of: moments.length, examples: saved.slice(0, 3).map((m) => m.headline) });
    }
    return saved.length;
  }

  private async teamName(id: string | null): Promise<string | null> {
    if (!id) return null;
    const { data, error } = await this.db.from("teams").select("display_name").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as { display_name: string } | null)?.display_name ?? null;
  }

  /** One row, "hometown", in engine_heartbeats: games is the moments the
   *  last tick made. */
  private async heartbeat(started: number, made: number | null, error: string | null): Promise<void> {
    const at = new Date(this.now()).toISOString();
    const row: Record<string, unknown> = {
      league: "hometown",
      last_poll_at: at,
      latency_ms: this.now() - started,
      consecutive_failures: this.failures,
      updated_at: at,
    };
    if (made !== null) row.games = made;
    if (error) {
      row.last_error_at = at;
      row.last_error = error;
    } else row.last_ok_at = at;
    const { error: e } = await this.db.from("engine_heartbeats").upsert(row, { onConflict: "league" });
    if (e) throw e;
  }
}
