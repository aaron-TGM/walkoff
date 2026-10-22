import type { Sport } from "./types";

// Per-league knobs for the rules. Thresholds are in the sport's own units
// (runs, points, goals).
export interface LeagueRules {
  sport: Sport;
  /** Regulation periods: innings, quarters, halves or periods. */
  regulationPeriods: number;
  /** Deficit the winner must have overcome for a comeback win. */
  comebackDeficit: number;
  /** Final margin that counts as a heartbreaker for the loser. */
  heartbreakMargin: number;
  /** Margin that makes a late game a close game. */
  closeMargin: number;
  /** How close a trailing team must get for a comeback to be "on". */
  oneScore: number;
  /** Seconds left (timed sports) or minute reached (soccer) for "late". */
  lateWindow: number;
  /** Longest a game normally lasts, minutes. Used to skip stale finals. */
  maxDurationMinutes: number;
  /** How to read the scoreboard: by week (football) or by date. */
  scoreboard: "week" | "date";
  /** Extra scoreboard query params, e.g. all FBS games instead of featured. */
  query?: string;
}

export const LEAGUE_RULES: Record<string, LeagueRules> = {
  nfl: {
    sport: "football",
    regulationPeriods: 4,
    comebackDeficit: 14,
    heartbreakMargin: 3,
    closeMargin: 8,
    oneScore: 8,
    lateWindow: 300,
    maxDurationMinutes: 240,
    scoreboard: "week",
  },
  ncaaf: {
    sport: "football",
    regulationPeriods: 4,
    comebackDeficit: 14,
    heartbreakMargin: 3,
    closeMargin: 8,
    oneScore: 8,
    lateWindow: 300,
    maxDurationMinutes: 270,
    scoreboard: "week",
    query: "groups=80&limit=300",
  },
  nba: {
    sport: "basketball",
    regulationPeriods: 4,
    comebackDeficit: 15,
    heartbreakMargin: 3,
    closeMargin: 5,
    oneScore: 3,
    lateWindow: 180,
    maxDurationMinutes: 180,
    scoreboard: "date",
  },
  ncaab: {
    sport: "basketball",
    regulationPeriods: 2,
    comebackDeficit: 12,
    heartbreakMargin: 3,
    closeMargin: 5,
    oneScore: 3,
    lateWindow: 180,
    maxDurationMinutes: 165,
    scoreboard: "date",
    query: "groups=50&limit=500",
  },
  nhl: {
    sport: "hockey",
    regulationPeriods: 3,
    comebackDeficit: 2,
    heartbreakMargin: 1,
    closeMargin: 1,
    oneScore: 0,
    lateWindow: 300,
    maxDurationMinutes: 180,
    scoreboard: "date",
  },
  epl: {
    sport: "soccer",
    regulationPeriods: 2,
    comebackDeficit: 1,
    heartbreakMargin: 1,
    closeMargin: 1,
    oneScore: 0,
    lateWindow: 85,
    maxDurationMinutes: 135,
    scoreboard: "date",
  },
  mlb: {
    sport: "baseball",
    regulationPeriods: 9,
    comebackDeficit: 4,
    heartbreakMargin: 1,
    closeMargin: 1,
    oneScore: 1,
    lateWindow: 8,
    maxDurationMinutes: 270,
    scoreboard: "date",
  },
};

export function rulesFor(league: string): LeagueRules {
  const rules = LEAGUE_RULES[league];
  if (!rules) throw new Error(`No moment rules for league "${league}"`);
  return rules;
}
