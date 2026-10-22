import type { Moment, TeamRef, TrackedGame } from "../moments/types";
import type { Heartbeat, Store, StoredGame } from "./types";

/** Dry-run store: keeps everything in memory. Also used by tests. */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  readonly teams = new Map<string, TeamRef>();
  readonly games = new Map<string, TrackedGame>();
  readonly moments = new Map<string, Moment>();
  readonly heartbeats = new Map<string, Heartbeat>();
  /** When each game was last saved, like the updated_at column. */
  private readonly savedAt = new Map<string, number>();

  async loadRecentGames(league: string, since: Date): Promise<StoredGame[]> {
    return [...this.games.values()]
      .filter(
        (t) => t.game.league === league && (this.savedAt.get(t.game.id) ?? 0) >= since.getTime(),
      )
      .map((t) => ({
        id: t.game.id,
        state: t.game.state,
        completed: t.game.completed,
        maxHomeDeficit: t.maxHomeDeficit,
        maxAwayDeficit: t.maxAwayDeficit,
        finalAt: t.finalAt,
      }));
  }

  async saveTeams(teams: TeamRef[]): Promise<void> {
    for (const t of teams) this.teams.set(t.id, t);
  }

  async saveGames(games: TrackedGame[]): Promise<void> {
    for (const t of games) {
      this.games.set(t.game.id, t);
      this.savedAt.set(t.game.id, Date.now());
    }
  }

  async saveMoments(moments: Moment[]): Promise<Moment[]> {
    const fresh = moments.filter((m) => !this.moments.has(m.dedupeKey));
    for (const m of fresh) this.moments.set(m.dedupeKey, m);
    return fresh;
  }

  async saveHeartbeat(heartbeat: Heartbeat): Promise<void> {
    this.heartbeats.set(heartbeat.league, heartbeat);
  }
}
