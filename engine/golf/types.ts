// Golf in the engine's own shapes. normalize.ts converts ESPN's leaderboard
// into these, so the rules never touch raw feed JSON. A golfer's id is the
// same on every tour.
import type { CircuitEvent, CircuitState, Entrant } from "../circuits/poller";

export interface GolfRound {
  period: number;
  /** Strokes, once the round has a score. */
  strokes: number | null;
  teeTime: string | null;
}

export interface GolfPlayer extends Entrant {
  /** Place on the leaderboard: 1 for the leader or a tie for it. Null when
   *  the feed gives none (missed cut, withdrew). */
  position: number | null;
  tied: boolean;
  /** In a playoff for the win. */
  playoff: boolean;
  /** Score to par: -12. */
  toPar: number | null;
  /** The round the player is on or last played, and its tee time. */
  period: number | null;
  teeTime: string | null;
  rounds: GolfRound[];
}

export type GolfState = CircuitState;

export interface GolfEvent extends CircuitEvent {
  tour: string;
  externalId: string;
  startDate: string;
  endDate: string;
  /** The feed's status name for the event as a whole: "STATUS_FINAL",
   *  "STATUS_PLAY_COMPLETE", "STATUS_SUSPENDED". */
  statusName: string;
  /** Whether the feed calls the current round complete. After round 3 it
   *  does, though there's a round to go: only state final crowns a winner. */
  roundComplete: boolean;
  /** The round the event is on. */
  period: number | null;
  /** Rounds in the event: 4, or 3 for LIV and a shortened event. */
  rounds: number;
  /** What the feed says, for comparing against majors.ts. */
  majorFlag: boolean | null;
  players: GolfPlayer[];
}
