export type TriggerCategory = "before" | "during" | "after" | "season";

export interface Trigger {
  name: string;
  id: string;
  description: string;
  category: TriggerCategory;
}

export const TRIGGER_CATEGORIES: { id: TriggerCategory; label: string }[] = [
  { id: "before", label: "Before the game" },
  { id: "during", label: "During the game" },
  { id: "after", label: "After the game" },
  { id: "season", label: "The season" },
];

export const TRIGGERS: Trigger[] = [
  {
    name: "Rivalry Preview",
    id: "rivalry_preview",
    description:
      "Rival matchup within 48 hours. Build anticipation before the game.",
    category: "before",
  },
  {
    name: "Big Game Alert",
    id: "big_game_alert",
    description:
      "Playoff, primetime, or must-win. Fire while fans are already buzzing.",
    category: "before",
  },
  {
    name: "Season Opener",
    id: "season_opener",
    description:
      "Opening Day, Puck Drop, Kickoff. Best re-engagement of the year.",
    category: "before",
  },
  {
    name: "Close Game",
    id: "close_game",
    description:
      "Tied or within one score in the final period. Fans are on their phones.",
    category: "during",
  },
  {
    name: "Comeback Live",
    id: "comeback_live",
    description:
      "Down 5+ and rallying. Highest real-time engagement of any trigger.",
    category: "during",
  },
  {
    name: "Clutch Moment",
    id: "clutch_moment",
    description:
      "Bases loaded. Final at-bat. Last-second shot. Everyone watching.",
    category: "during",
  },
  {
    name: "Walk-Off Win",
    id: "walkoff_win",
    description:
      "Highest emotional spike. 30-min window. Timing is the conversion lever.",
    category: "after",
  },
  {
    name: "Comeback Win",
    id: "comeback_win",
    description:
      "Won after trailing. Strong cart recovery and lapsed buyer angle.",
    category: "after",
  },
  {
    name: "Rivalry Win",
    id: "rivalry_win",
    description:
      "Yankees-Red Sox. Iron Bowl. Lakers-Celtics. Configurable per account.",
    category: "after",
  },
  {
    name: "Heartbreaker Loss",
    id: "heartbreak_loss",
    description:
      "Lost by one. Consolation angle with soft offer converts well.",
    category: "after",
  },
  {
    name: "Playoff Clinch",
    id: "playoff_clinch",
    description:
      "Postseason berth locked. Pairs with limited drops or playoff bundles.",
    category: "season",
  },
  {
    name: "Player Milestone",
    id: "player_milestone",
    description:
      "Configurable. Records, awards, NIL moments. Big for NCAA brands.",
    category: "season",
  },
  {
    name: "Championship Win",
    id: "title_won",
    description:
      "World Series. Stanley Cup. National Championship. Once a year.",
    category: "season",
  },
];
