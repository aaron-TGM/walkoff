// Hometown moments for team sports. When the poller saves a title, this
// job records the champion's players as athlete results (who led, who
// played, who was on the roster) and makes a moment for each town they're
// from (lib/hometown). A playoff walk-off or buzzer-beater does the same for
// whoever decided it (engine/moments/deciders.ts), once
// 010_player_moments.sql has run. Every tick it looks again at the last 72
// hours, so a hometown fixed or found since then gets its town's moment.
// It reads only what's saved, so a poll never waits on it. HOMETOWN=0 turns
// it off. See engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { athleteId, athletesReady, has010, loadAthletes, resultsFor, saveResults, teamRoster, type AthleteResult, type ResultRole } from "../lib/athletes";
import { makeHometownMoments, ROLE_INTENSITY } from "../lib/hometown";
import { LEAGUES } from "../lib/leagues";
import type { AthleteSync } from "./athletes/sync";
import { errorMessage, log } from "./log";
import type { Decider } from "./moments/deciders";
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
  /** A game-winner the roster doesn't have yet: the team's roster is read
   *  again unless it's newer than this. */
  deciderRosterAge: HOUR,
  /** A playoff game won at the very end, and one in a final round. */
  gameWinner: 0.9,
  gameWinnerFinal: 0.95,
};

/** Final rounds, from the game's note: "World Series - Game 3". */
const FINAL_ROUND = /world series|nba finals|stanley cup final|national championship/i;

/** A title, walk-off or buzzer-beater, as the poller saved it. */
interface TeamMomentRow {
  id: string;
  type: string;
  league: string;
  game_id: string | null;
  team_id: string | null;
  opponent_team_id: string | null;
  headline: string;
  detail: { round?: unknown; heroes?: unknown; decider?: unknown; gameHeadline?: unknown } | null;
  occurred_at: string;
}

/** The heroes the poller put on a title, if they look right. */
function heroesOf(t: TeamMomentRow): Heroes | null {
  const h = t.detail?.heroes as Partial<Heroes> | undefined;
  return h && Array.isArray(h.leaders) && Array.isArray(h.played) ? (h as Heroes) : null;
}

/** Who decided a playoff game, as the poller put it on the walk-off. */
function deciderOf(m: TeamMomentRow): Decider | null {
  const d = m.detail?.decider as Partial<Decider> | undefined;
  return d && typeof d.play === "string" && Array.isArray(d.athletes) && d.athletes.length ? (d as Decider) : null;
}

/** "NLDS - Game 2" reads "NLDS, Game 2". */
const roundOf = (m: TeamMomentRow) =>
  typeof m.detail?.gameHeadline === "string" && m.detail.gameHeadline.trim() ? m.detail.gameHeadline.trim().split(/\s+-\s+/).join(", ") : "a playoff game";

/** "football", from a league id: how athlete ids are keyed. */
const sportOf = (league: string) => LEAGUES.find((l) => l.id === league)?.feedPath.split("/")[0] ?? null;

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
  /** Titles whose champion has no roster on file, and game-winners who
   *  aren't on theirs, so they aren't asked about again every tick. */
  private readonly noRoster = new Set<string>();
  private waiting010 = false;

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
      const recent = await this.recentMoments();
      const titles = recent.filter((m) => m.type === "title_won");
      let finishes = recent.filter((m) => m.type !== "title_won" && deciderOf(m));
      if (finishes.length && !(await has010(this.db))) {
        if (!this.waiting010) log("WARNING", "Playoff game-winners are waiting for supabase/010_player_moments.sql to run");
        this.waiting010 = true;
        finishes = [];
      } else if (finishes.length) this.waiting010 = false;
      const recorded = await resultsFor(this.db, [...titles, ...finishes].map((t) => t.id));
      let made = 0;
      for (const t of titles) {
        const results = recorded.get(t.id) ?? (this.noRoster.has(t.id) ? [] : await this.record(t));
        if (results.length) made += await this.towns(t, results);
      }
      for (const f of finishes) {
        const results = recorded.get(f.id) ?? (this.noRoster.has(f.id) ? [] : await this.recordDecider(f));
        if (results.length) made += await this.towns(f, results);
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

  /** Titles, walk-offs and buzzer-beaters from the window. Only playoff
   *  ones carry a decider. */
  private async recentMoments(): Promise<TeamMomentRow[]> {
    const since = new Date(this.now() - HOMETOWN.window).toISOString();
    const { data, error } = await this.db
      .from("moments")
      .select("id, type, league, game_id, team_id, opponent_team_id, headline, detail, occurred_at")
      .in("type", ["title_won", "walkoff_win", "buzzer_beater"])
      .is("retracted_at", null)
      .gte("detected_at", since)
      .order("detected_at");
    if (error) throw error;
    return (data ?? []) as TeamMomentRow[];
  }

  /** The champion's players, from its roster now, each with their part. */
  private async record(t: TeamMomentRow): Promise<AthleteResult[]> {
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

  /** Who decided a playoff game, as athletes Walkoff knows: the team's
   *  roster is read again first when one of them isn't on file. */
  private async recordDecider(m: TeamMomentRow): Promise<AthleteResult[]> {
    const decider = deciderOf(m);
    const sport = sportOf(m.league);
    if (!decider || !sport || !m.game_id) return [];
    const ids = decider.athletes.map((a) => athleteId(sport, a.id));
    let known = await loadAthletes(this.db, ids);
    if (known.length < ids.length && this.options.rosters && m.team_id) {
      const r = await this.options.rosters.refreshTeam(m.team_id, HOMETOWN.deciderRosterAge);
      if (r === "synced") known = await loadAthletes(this.db, ids);
    }
    if (!known.length) {
      this.noRoster.add(m.id);
      log("WARNING", "A playoff game-winner isn't on file", { moment: m.headline, athletes: decider.athletes.map((a) => a.name) });
      return [];
    }
    const round = roundOf(m);
    const results = known.map(
      (a): AthleteResult => ({
        athleteId: a.id,
        eventKey: m.game_id!,
        eventName: round,
        kind: "game_winner",
        role: "leader",
        teamId: m.team_id,
        momentId: m.id,
        intensity: FINAL_ROUND.test(round) ? HOMETOWN.gameWinnerFinal : HOMETOWN.gameWinner,
        occurredAt: m.occurred_at,
        createdBy: "engine",
      }),
    );
    await saveResults(this.db, results);
    log("INFO", "Recorded a playoff game-winner", { moment: m.headline, athletes: known.map((a) => a.displayName) });
    return results;
  }

  /** A moment for each town the players are from. Towns that have theirs
   *  already keep it. */
  private async towns(t: TeamMomentRow, results: AthleteResult[]): Promise<number> {
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
        kind: first.kind,
        league: t.league,
        gameId: t.game_id,
        teamId: t.team_id,
        teamName: await this.teamName(t.team_id),
        opponentTeamId: t.opponent_team_id,
        occurredAt: t.occurred_at,
        ...(first.kind === "game_winner" ? { play: deciderOf(t)?.play ?? null } : {}),
      },
      results,
      led,
    );
    if (saved.length) {
      log("INFO", "Hometown moments", { from: t.headline, towns: saved.length, of: moments.length, examples: saved.slice(0, 3).map((m) => m.headline) });
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
