// The golf tours Walkoff follows, for hometown moments: a town celebrates
// when someone from there wins. Kept apart from lib/leagues.ts, which is for
// teams: tours have no territories, rosters, pricing or status probes.

export interface Tour {
  /** The feed's league slug: "pga". */
  id: string;
  name: string;
  /** What a win counts for, before majors and elevated events. */
  winIntensity: number;
}

export const TOURS: Tour[] = [
  { id: "pga", name: "PGA Tour", winIntensity: 0.8 },
  { id: "lpga", name: "LPGA Tour", winIntensity: 0.8 },
  { id: "eur", name: "DP World Tour", winIntensity: 0.75 },
  { id: "liv", name: "LIV Golf", winIntensity: 0.7 },
];

export const tourById = (id: string) => TOURS.find((t) => t.id === id);
