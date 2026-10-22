import type { GameStateName, Moment, TeamRef, TrackedGame } from "../moments/types";

/** What the engine needs back from storage after a restart. */
export interface StoredGame {
  id: string;
  state: GameStateName;
  completed: boolean;
  maxHomeDeficit: number;
  maxAwayDeficit: number;
  finalAt: string | null;
}

export interface Heartbeat {
  league: string;
  at: string;
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
  games: number;
  liveGames: number;
  consecutiveFailures: number;
}

export interface Store {
  readonly kind: "supabase" | "memory";
  loadRecentGames(league: string, since: Date): Promise<StoredGame[]>;
  saveTeams(teams: TeamRef[]): Promise<void>;
  saveGames(games: TrackedGame[]): Promise<void>;
  /** Saves moments, skipping any already stored. Returns only the new ones. */
  saveMoments(moments: Moment[]): Promise<Moment[]>;
  saveHeartbeat(heartbeat: Heartbeat): Promise<void>;
}
