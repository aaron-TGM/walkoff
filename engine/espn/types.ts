// The parts of ESPN's site API JSON the engine reads. Everything is optional
// because the feed is undocumented and fields come and go.

export interface EspnTeam {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  location?: string;
  color?: string;
  alternateColor?: string;
}

export interface EspnCompetitor {
  homeAway?: "home" | "away";
  winner?: boolean;
  score?: string;
  linescores?: { value?: number; period?: number }[];
  records?: { type?: string; summary?: string }[];
  team?: EspnTeam;
}

export interface EspnStatus {
  clock?: number;
  displayClock?: string;
  period?: number;
  type?: {
    name?: string;
    state?: "pre" | "in" | "post";
    completed?: boolean;
    description?: string;
    detail?: string;
    shortDetail?: string;
  };
}

export interface EspnDetail {
  type?: { text?: string };
  clock?: { value?: number; displayValue?: string };
  team?: { id?: string };
  scoringPlay?: boolean;
  ownGoal?: boolean;
  penaltyKick?: boolean;
}

export interface EspnCompetition {
  id?: string;
  date?: string;
  neutralSite?: boolean;
  notes?: { headline?: string }[];
  status?: EspnStatus;
  competitors?: EspnCompetitor[];
  details?: EspnDetail[];
  situation?: {
    onFirst?: boolean;
    onSecond?: boolean;
    onThird?: boolean;
    outs?: number;
    possession?: string;
  };
  series?: {
    type?: string;
    summary?: string;
    completed?: boolean;
    totalCompetitions?: number;
    competitors?: { id?: string; wins?: number }[];
  };
}

export interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  season?: { year?: number; type?: number };
  status?: EspnStatus;
  competitions?: EspnCompetition[];
}

export interface EspnScoreboard {
  events?: EspnEvent[];
}

export interface EspnSummary {
  /** Football: every score with the clock and the running total. */
  scoringPlays?: {
    period?: { number?: number };
    clock?: { value?: number; displayValue?: string };
    homeScore?: number;
    awayScore?: number;
    team?: { id?: string };
    text?: string;
  }[];
  /** Basketball: full play-by-play; scoring plays carry the running total. */
  plays?: {
    period?: { number?: number };
    clock?: { displayValue?: string };
    scoringPlay?: boolean;
    homeScore?: number;
    awayScore?: number;
    team?: { id?: string } | null;
    text?: string;
  }[];
  /** Each side's box score: everyone with a line, in groups (passing,
   *  batting, forwards). Basketball lists the bench too, as didNotPlay. */
  boxscore?: {
    players?: {
      team?: { id?: string };
      statistics?: {
        name?: string;
        /** Baseball names its groups here: "batting", "pitching". */
        type?: string;
        keys?: string[];
        athletes?: {
          athlete?: { id?: string; displayName?: string };
          stats?: string[];
          didNotPlay?: boolean;
        }[];
      }[];
    }[];
  };
  /** Each side's leaders in the game, by category. Not in baseball. */
  leaders?: {
    team?: { id?: string };
    leaders?: {
      name?: string;
      displayName?: string;
      leaders?: { displayValue?: string; athlete?: { id?: string; displayName?: string } }[];
    }[];
  }[];
  header?: {
    competitions?: {
      status?: {
        /** Baseball's winning pitcher, hockey's winning goalie and three stars. */
        featuredAthletes?: {
          name?: string;
          displayName?: string;
          athlete?: { id?: string; displayName?: string };
          team?: { id?: string };
        }[];
      };
    }[];
  };
}
