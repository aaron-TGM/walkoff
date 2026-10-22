import type { League } from "../lib/leagues";
import type { EngineConfig } from "./config";
import type { FeedClient } from "./espn/client";
import { normalizeScoreboard, scoringEventsFromSummary } from "./espn/normalize";
import type { EspnScoreboard } from "./espn/types";
import { errorMessage, log } from "./log";
import { finalMoments, finalStatus, liveMoments, preMoments, track } from "./moments/rules";
import type { LeagueRules } from "./moments/sports";
import type { GameState, Moment, ScoringEvent, TeamRef, TrackedGame } from "./moments/types";
import type { Store, StoredGame } from "./store/types";

const ET_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const ET_HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  hourCycle: "h23",
});

/** YYYYMMDD in US Eastern time, which is how the feed groups games by day. */
export function etDate(d: Date, offsetDays = 0): string {
  return ET_DATE.format(new Date(d.getTime() + offsetDays * 86_400_000)).replaceAll("-", "");
}

export interface LeagueStatus {
  league: string;
  lastPollAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  latencyMs: number | null;
  games: number;
  liveGames: number;
  momentsSaved: number;
  nextPollInMs: number | null;
}

interface Deps {
  client: FeedClient;
  store: Store;
  config: EngineConfig;
  now?: () => Date;
}

export class LeaguePoller {
  private readonly tracked = new Map<string, TrackedGame>();
  /** Saved state per game, so unchanged games aren't re-written every poll. */
  private readonly savedFingerprints = new Map<string, string>();
  private readonly savedTeams = new Set<string>();
  private restored = new Map<string, StoredGame>();
  private restoredOnce = false;
  private lastLookahead = 0;
  readonly status: LeagueStatus;

  constructor(
    readonly league: League,
    private readonly rules: LeagueRules,
    private readonly deps: Deps,
  ) {
    this.status = {
      league: league.id,
      lastPollAt: null,
      lastOkAt: null,
      lastError: null,
      consecutiveFailures: 0,
      latencyMs: null,
      games: 0,
      liveGames: 0,
      momentsSaved: 0,
      nextPollInMs: null,
    };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  /** One poll. Never throws. Returns milliseconds until the next poll. */
  async tick(): Promise<number> {
    const now = this.now();
    this.status.lastPollAt = now.toISOString();
    const started = Date.now();
    try {
      if (!this.restoredOnce) await this.restore(now);
      const boards = await this.fetchBoards(now);
      const latencyMs = Date.now() - started;

      const games = new Map<string, GameState>();
      for (const board of boards) {
        for (const g of normalizeScoreboard(this.league.id, board)) games.set(g.id, g);
      }

      const moments: Moment[] = [];
      const changed: TrackedGame[] = [];
      const finalized: string[] = [];
      for (const g of games.values()) {
        const prev = this.tracked.get(g.id) ?? this.fromStore(g);
        let t = track(prev, g, now);
        moments.push(...preMoments(g, now), ...liveMoments(t, this.rules, now));

        const final = finalStatus(prev, t, this.rules, now);
        if (final === "stale") {
          t = { ...t, finalProcessed: true };
        } else if (final === "process") {
          const { events, ok } = await this.scoringEvents(g);
          if (ok || t.summaryAttempts >= 2) {
            moments.push(...finalMoments(t, this.rules, events, now));
            t = { ...t, finalProcessed: true };
            finalized.push(g.id);
          } else {
            t = { ...t, summaryAttempts: t.summaryAttempts + 1 };
          }
        }

        this.tracked.set(g.id, t);
        if (fingerprint(t) !== this.savedFingerprints.get(g.id)) changed.push(t);
      }

      const fresh = moments.filter((m) => !this.tracked.get(m.gameId)?.emitted.has(m.dedupeKey));
      try {
        await this.persist(changed, fresh);
      } catch (e) {
        // Retry these finals next poll instead of losing their moments.
        for (const id of finalized) {
          const t = this.tracked.get(id);
          if (t) this.tracked.set(id, { ...t, finalProcessed: false });
        }
        throw e;
      }

      const list = [...games.values()];
      this.status.lastOkAt = now.toISOString();
      this.status.lastError = null;
      this.status.consecutiveFailures = 0;
      this.status.latencyMs = latencyMs;
      this.status.games = list.length;
      this.status.liveGames = list.filter((g) => g.state === "in").length;
      await this.heartbeat(true);
      this.forgetOldGames(now, games);

      const delay = this.nextDelay(list, now);
      this.status.nextPollInMs = delay;
      return delay;
    } catch (e) {
      this.status.consecutiveFailures++;
      this.status.lastError = errorMessage(e);
      log("WARNING", `Poll failed for ${this.league.id}`, {
        league: this.league.id,
        error: this.status.lastError,
        consecutiveFailures: this.status.consecutiveFailures,
      });
      await this.heartbeat(false);
      // Back off: 15s, 30s, 60s ... up to the idle interval.
      const delay = Math.min(
        this.deps.config.idlePollMs,
        15_000 * 2 ** (this.status.consecutiveFailures - 1),
      );
      this.status.nextPollInMs = delay;
      return delay;
    }
  }

  /** Reload what we knew about recent games, so a restart neither misses a
   *  final it was watching nor repeats moments it already sent. */
  private async restore(now: Date): Promise<void> {
    const since = new Date(now.getTime() - 36 * 3_600_000);
    const stored = await this.deps.store.loadRecentGames(this.league.id, since);
    this.restored = new Map(stored.map((s) => [s.id, s]));
    this.restoredOnce = true;
    if (stored.length) {
      log("INFO", `Restored ${stored.length} recent ${this.league.id} games`, { league: this.league.id });
    }
  }

  private fromStore(g: GameState): TrackedGame | null {
    const s = this.restored.get(g.id);
    if (!s) return null;
    this.restored.delete(g.id);
    return {
      game: { ...g, state: s.state, completed: s.completed },
      maxHomeDeficit: s.maxHomeDeficit,
      maxAwayDeficit: s.maxAwayDeficit,
      finalAt: s.finalAt,
      finalProcessed: s.state === "post" && s.completed,
      summaryAttempts: 0,
      emitted: new Set(),
    };
  }

  private async fetchBoards(now: Date): Promise<EspnScoreboard[]> {
    const { client } = this.deps;
    const extra = this.rules.query ?? "";
    if (this.rules.scoreboard === "week") {
      return [await client.scoreboard(this.league.feedPath, extra)];
    }
    const dates = [etDate(now)];
    // Late games finish after midnight Eastern; keep yesterday until morning.
    if (Number(ET_HOUR.format(now)) < 6) dates.push(etDate(now, -1));
    if (now.getTime() - this.lastLookahead >= this.deps.config.lookaheadMs) {
      dates.push(etDate(now, 1), etDate(now, 2));
      this.lastLookahead = now.getTime();
    }
    return Promise.all(
      dates.map((d) =>
        client.scoreboard(this.league.feedPath, extra ? `dates=${d}&${extra}` : `dates=${d}`),
      ),
    );
  }

  /** Play-by-play scoring for finals that need it. `ok` is false when the
   *  fetch failed and is worth retrying. */
  private async scoringEvents(g: GameState): Promise<{ events: ScoringEvent[] | null; ok: boolean }> {
    if (g.sport !== "football" && g.sport !== "basketball") return { events: null, ok: true };
    try {
      const summary = await this.deps.client.summary(this.league.feedPath, g.externalId);
      return { events: scoringEventsFromSummary(g.sport, summary), ok: true };
    } catch (e) {
      log("WARNING", `Play-by-play unavailable for ${g.shortName}`, {
        league: this.league.id,
        game: g.id,
        error: errorMessage(e),
      });
      return { events: null, ok: false };
    }
  }

  private async persist(changed: TrackedGame[], moments: Moment[]): Promise<void> {
    const { store } = this.deps;

    // Moments point at games and teams, so those go first.
    const games = new Map(changed.map((t) => [t.game.id, t]));
    for (const m of moments) {
      const t = this.tracked.get(m.gameId);
      if (t && !this.savedFingerprints.has(m.gameId)) games.set(m.gameId, t);
    }
    const teams = new Map<string, TeamRef>();
    for (const t of games.values()) {
      for (const team of [t.game.home.team, t.game.away.team]) {
        if (!this.savedTeams.has(team.id)) teams.set(team.id, team);
      }
    }

    if (teams.size) {
      await store.saveTeams([...teams.values()]);
      for (const id of teams.keys()) this.savedTeams.add(id);
    }
    if (games.size) {
      await store.saveGames([...games.values()]);
      for (const t of games.values()) this.savedFingerprints.set(t.game.id, fingerprint(t));
    }
    if (!moments.length) return;

    const inserted = await store.saveMoments(moments);
    for (const m of moments) this.tracked.get(m.gameId)?.emitted.add(m.dedupeKey);
    this.status.momentsSaved += inserted.length;
    for (const m of inserted) {
      log("INFO", m.headline, {
        moment: m.type,
        league: m.league,
        team: m.team.displayName,
        intensity: m.intensity,
        game: m.gameId,
        dryRun: store.kind === "memory" || undefined,
      });
    }
  }

  private async heartbeat(ok: boolean): Promise<void> {
    try {
      await this.deps.store.saveHeartbeat({
        league: this.league.id,
        at: this.status.lastPollAt ?? new Date().toISOString(),
        ok,
        error: ok ? null : this.status.lastError,
        latencyMs: this.status.latencyMs,
        games: this.status.games,
        liveGames: this.status.liveGames,
        consecutiveFailures: this.status.consecutiveFailures,
      });
    } catch (e) {
      log("WARNING", "Heartbeat not saved", { league: this.league.id, error: errorMessage(e) });
    }
  }

  private nextDelay(games: GameState[], now: Date): number {
    const { livePollMs, soonPollMs, idlePollMs } = this.deps.config;
    if (games.some((g) => g.state === "in")) return livePollMs;
    const soon = games.some((g) => {
      if (g.state !== "pre") return false;
      const startsIn = Date.parse(g.startsAt) - now.getTime();
      // Includes games running late past their scheduled start.
      return startsIn < 30 * 60_000 && startsIn > -3 * 3_600_000;
    });
    const unsettled = games.some(
      (g) => g.state === "post" && g.completed && !this.tracked.get(g.id)?.finalProcessed,
    );
    return soon || unsettled ? soonPollMs : idlePollMs;
  }

  /** Drop old games that have left the scoreboard. */
  private forgetOldGames(now: Date, onBoard: Map<string, GameState>): void {
    const cutoff = now.getTime() - 48 * 3_600_000;
    for (const [id, t] of this.tracked) {
      if (!onBoard.has(id) && Date.parse(t.game.startsAt) < cutoff) {
        this.tracked.delete(id);
        this.savedFingerprints.delete(id);
      }
    }
  }
}

function fingerprint(t: TrackedGame): string {
  const g = t.game;
  return [
    g.state,
    g.completed,
    g.home.score,
    g.away.score,
    g.period,
    g.statusDetail,
    t.maxHomeDeficit,
    t.maxAwayDeficit,
    t.finalAt,
  ].join("|");
}
