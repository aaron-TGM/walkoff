export interface League {
  id: string;
  name: string;
  /** Path segment for the league's live scoreboard feed. */
  feedPath: string;
  /** Shown next to leagues that aren't in season for V1 yet. */
  note?: string;
}

export const LEAGUES: League[] = [
  { id: "nfl", name: "NFL", feedPath: "football/nfl" },
  { id: "nba", name: "NBA", feedPath: "basketball/nba" },
  { id: "nhl", name: "NHL", feedPath: "hockey/nhl" },
  { id: "ncaaf", name: "NCAA Football", feedPath: "football/college-football" },
  {
    id: "ncaab",
    name: "NCAA Basketball",
    feedPath: "basketball/mens-college-basketball",
  },
  { id: "epl", name: "Premier League", feedPath: "soccer/eng.1" },
  {
    id: "mlb",
    name: "MLB",
    feedPath: "baseball/mlb",
    note: "Opening Day 2027",
  },
];

export const LEAGUE_IDS = new Set(LEAGUES.map((l) => l.id));
