// The engine's own data shapes. Feed adapters (engine/espn) convert into
// these, so rules never touch raw feed JSON.

export type Sport = "football" | "basketball" | "hockey" | "soccer" | "baseball";
export type GameStateName = "pre" | "in" | "post";
export type HomeAway = "home" | "away";
export type Phase = "before" | "during" | "after" | "season";

/** Moment types the engine emits. Each one must exist in lib/triggers.ts. */
export type MomentType =
  | "rivalry_preview"
  | "big_game_alert"
  | "season_opener"
  | "close_game"
  | "comeback_live"
  | "clutch_moment"
  | "team_win"
  | "walkoff_win"
  | "buzzer_beater"
  | "late_winner"
  | "comeback_win"
  | "rivalry_win"
  | "heartbreak_loss"
  | "playoff_advance"
  | "title_won";

export interface TeamRef {
  /** Engine id, e.g. "espn:nfl:21". */
  id: string;
  league: string;
  externalId: string;
  abbreviation: string;
  displayName: string;
  shortName: string;
  location: string;
  color: string | null;
  alternateColor: string | null;
}

export interface Side {
  team: TeamRef;
  score: number;
  winner: boolean | null;
  /** Points per period in order (innings, quarters, halves, periods). */
  linescores: number[];
  /** Overall record before or after the game, e.g. "0-0". */
  record: string | null;
}

export interface GoalEvent {
  /** Match minute including stoppage time: "90'+3'" is 93. */
  minute: number;
  display: string;
  /** Feed id of the team credited with the goal (own goals included). */
  teamExternalId: string;
  ownGoal: boolean;
  penalty: boolean;
}

export interface Situation {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  outs: number | null;
  /** Feed team id with the ball (football). */
  possessionExternalId: string | null;
}

export interface SeriesInfo {
  completed: boolean;
  summary: string;
  /** Feed team id that won the series, once completed. */
  winnerExternalId: string | null;
}

export interface GameState {
  /** Engine id, e.g. "espn:mlb:401908003". */
  id: string;
  league: string;
  sport: Sport;
  externalId: string;
  name: string;
  shortName: string;
  startsAt: string;
  state: GameStateName;
  completed: boolean;
  statusDetail: string;
  period: number;
  /** Seconds left in the period. Football, basketball and hockey only. */
  clockSeconds: number | null;
  /** Match minute including stoppage time. Soccer only. */
  minute: number | null;
  /** Which half of the inning is being played. Baseball only. */
  inningHalf: "top" | "mid" | "bottom" | "end" | null;
  /** Feed season type: 1 preseason, 2 regular season, 3 postseason. */
  seasonType: number;
  /** First feed note, e.g. "NLCS - Game 4". */
  headline: string | null;
  neutralSite: boolean;
  home: Side;
  away: Side;
  /** Soccer only, in match order. */
  goals: GoalEvent[];
  situation: Situation | null;
  series: SeriesInfo | null;
}

/** One score change, from a feed's play-by-play. Scores are after the play. */
export interface ScoringEvent {
  period: number;
  /** Seconds left in the period (timed sports) or match minute (soccer). */
  clock: number;
  homeScore: number;
  awayScore: number;
  teamExternalId: string | null;
  text: string;
}

/** What the engine remembers about a game between polls. */
export interface TrackedGame {
  game: GameState;
  maxHomeDeficit: number;
  maxAwayDeficit: number;
  /** When the engine first saw the game final, ISO. */
  finalAt: string | null;
  /** True once the game's final moments were emitted (or skipped as stale). */
  finalProcessed: boolean;
  /** Failed play-by-play fetches for this final, so we stop retrying. */
  summaryAttempts: number;
  /** Dedupe keys already saved, so live rules don't re-insert every poll. */
  emitted: Set<string>;
}

export interface Moment {
  dedupeKey: string;
  type: MomentType;
  category: "sports";
  phase: Phase;
  league: string;
  gameId: string;
  team: TeamRef;
  opponent: TeamRef | null;
  headline: string;
  intensity: number;
  detail: Record<string, unknown>;
  occurredAt: string;
}
