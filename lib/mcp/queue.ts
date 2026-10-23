// Which moments a brand should act on, and how long each one keeps.
import { momentKind } from "./campaign";

export interface TriggerRule {
  id: string;
  name: string;
  /** Empty: any moment. */
  moment_types: string[];
  /** "nfl:24". Empty: the brand's standout territories. */
  team_keys: string[];
  min_intensity: number;
  active: boolean;
}

export interface QueueMoment {
  type: string;
  intensity: number;
  occurredAt: Date;
  gameStart: Date | null;
  /** "nfl:24", or null for a team Walkoff has no territory for. */
  teamKey: string | null;
}

/** With no rules of its own, a brand acts on its standout teams' wins,
 *  heartbreakers, big games and season moments. Ordinary wins in sports
 *  with a game most days fall under the intensity bar (engine/moments/sports). */
export const DEFAULT_RULE: TriggerRule = {
  id: "default",
  name: "Big moments for your standout teams",
  moment_types: [
    "team_win",
    "walkoff_win",
    "buzzer_beater",
    "late_winner",
    "comeback_win",
    "rivalry_win",
    "heartbreak_loss",
    "rivalry_preview",
    "big_game_alert",
    "season_opener",
    "playoff_clinch",
    "playoff_advance",
    "title_won",
    "great_escape",
  ],
  team_keys: [],
  min_intensity: 0.6,
  active: true,
};

/** The first active rule a moment matches. */
export function matchingRule(m: QueueMoment, rules: TriggerRule[], standouts: string[]): TriggerRule | null {
  for (const r of rules) {
    if (!r.active) continue;
    if (r.moment_types.length && !r.moment_types.includes(m.type)) continue;
    const teams = r.team_keys.length ? r.team_keys : standouts;
    if (!m.teamKey || !teams.includes(m.teamKey)) continue;
    if (m.intensity < r.min_intensity) continue;
    return r;
  }
  return null;
}

export interface MomentWindow {
  status: "open" | "closing" | "closed";
  closes_at: string | null;
  note: string;
}

const HOUR = 3_600_000;

/** How long a moment is worth acting on: a result for about a day, a
 *  season moment for three, a pre-game moment until kickoff, a live one
 *  only for a few hours. */
export function momentWindow(m: QueueMoment, now: Date): MomentWindow {
  const kind = momentKind(m.type);
  const start = m.occurredAt.getTime();
  const closes =
    kind === "pregame"
      ? (m.gameStart?.getTime() ?? start + 24 * HOUR)
      : start + (kind === "live" ? 3 : kind === "season" ? 72 : 30) * HOUR;
  const left = closes - now.getTime();
  const closesAt = new Date(closes).toISOString();
  if (left <= 0) return { status: "closed", closes_at: closesAt, note: kind === "pregame" ? "The game has started." : "The window has passed." };
  const hours = left / HOUR;
  const leftText = hours < 1 ? `${Math.max(1, Math.round(hours * 60))} minutes` : `${Math.round(hours)} hours`;
  const closing = left < 0.25 * Math.max(closes - start, HOUR);
  return {
    status: closing ? "closing" : "open",
    closes_at: closesAt,
    note: kind === "pregame" ? `The game starts in ${leftText}.` : `About ${leftText} left to act.`,
  };
}
