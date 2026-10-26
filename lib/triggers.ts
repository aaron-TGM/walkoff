export type TriggerCategory = "before" | "during" | "after" | "season";

export interface Trigger {
  name: string;
  id: string;
  description: string;
  category: TriggerCategory;
  /** The engine doesn't detect it yet (engine/moments/types.ts). */
  coming?: boolean;
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
      "Rival matchup or derby within 48 hours. Build anticipation before kickoff.",
    category: "before",
  },
  {
    name: "Big Game Alert",
    id: "big_game_alert",
    description:
      "Playoff games, bowls and finals, within a day of kickoff. Reach fans while they're already buzzing.",
    category: "before",
  },
  {
    name: "Season Opener",
    id: "season_opener",
    description:
      "Opening Day, Puck Drop, Kickoff, Tip-Off. Best re-engagement of the year.",
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
      "Down big and rallying. Highest real-time engagement of any trigger.",
    category: "during",
  },
  {
    name: "Clutch Moment",
    id: "clutch_moment",
    description:
      "Bases loaded. Final drive. Last-second shot. Everyone watching.",
    category: "during",
  },
  {
    name: "Win",
    id: "team_win",
    description:
      "Any win. Weekly sports make the cut by default; daily ones don't, so fans don't hear from you after every game.",
    category: "after",
  },
  {
    name: "Walk-Off Win",
    id: "walkoff_win",
    description:
      "Highest emotional spike in sports. Timing is the conversion lever.",
    category: "after",
  },
  {
    name: "Buzzer Beater",
    id: "buzzer_beater",
    description:
      "Won on the final possession. NBA and college fans flood their phones.",
    category: "after",
  },
  {
    name: "Late Winner",
    id: "late_winner",
    description:
      "Won it in the final minutes. In soccer, a winner from the 85th minute: the Premier League version of a walk-off.",
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
      "Yankees-Red Sox. Iron Bowl. North London Derby. Walkoff knows the rivalries in every league.",
    category: "after",
  },
  {
    name: "Heartbreaker Loss",
    id: "heartbreak_loss",
    description:
      "Lost it late, or lost a close one. Consolation angle with a soft offer converts well.",
    category: "after",
  },
  {
    name: "Playoff Clinch",
    id: "playoff_clinch",
    description:
      "Postseason berth locked. Pairs with limited drops or playoff bundles.",
    category: "season",
    coming: true,
  },
  {
    name: "Series Win",
    id: "playoff_advance",
    description:
      "Won a playoff round. Fans are already buying for the next one.",
    category: "season",
  },
  {
    name: "Player Milestone",
    id: "player_milestone",
    description:
      "Records, awards, NIL moments. Big for NCAA.",
    category: "season",
    coming: true,
  },
  {
    name: "Big Signing",
    id: "big_signing",
    description:
      "Star trade or transfer lands in your market. New jersey, new reason to buy.",
    category: "season",
  },
  {
    name: "Great Escape",
    id: "great_escape",
    description:
      "Survived relegation on the final day. Relief sells almost as well as glory.",
    category: "season",
    coming: true,
  },
  {
    name: "Championship Win",
    id: "title_won",
    description:
      "Super Bowl. Stanley Cup. Premier League title. Once a year, if you're lucky.",
    category: "season",
  },
];

/** Hometown moments (lib/hometown): when someone from a town near a brand's
 *  customers wins, the town gets its own moment. Kept out of TRIGGERS, which
 *  the site lists, until they launch (lib/hometown/flag.ts). */
export const HOMETOWN_TRIGGERS: Trigger[] = [
  {
    name: "Hometown Champion",
    id: "hometown_title",
    description:
      "A player from a town near your customers just won a title. The whole town is celebrating: celebrate the town, never the player.",
    category: "season",
  },
  {
    name: "Hometown Win",
    id: "hometown_win",
    description:
      "Someone from the town won a tournament or a race. Golf, tennis, racing and surfing.",
    category: "season",
  },
  {
    name: "Hometown Contender",
    id: "hometown_contender",
    description:
      "Someone from the town leads going into the final round. The town is watching.",
    category: "before",
  },
  {
    name: "Hometown Game-Winner",
    id: "hometown_game_winner",
    description:
      "Someone from the town won a playoff game at the very end: a walk-off, a buzzer-beater, an overtime winner.",
    category: "after",
  },
];

/** Every moment type, hometown ones included. */
export const ALL_TRIGGERS: Trigger[] = [...TRIGGERS, ...HOMETOWN_TRIGGERS];
