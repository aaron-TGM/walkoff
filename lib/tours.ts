// The circuits Walkoff follows where athletes compete for themselves, for
// hometown moments: golf tours, tennis tours and racing series. A town
// celebrates when someone from there wins. Kept apart from lib/leagues.ts,
// which is for teams: tours have no territories, rosters, pricing or status
// probes.

export type TourSport = "golf" | "tennis" | "racing";

export interface Tour {
  /** "pga", "atp", "nascar": golf's feed slug, and Walkoff's id elsewhere. */
  id: string;
  name: string;
  sport: TourSport;
  /** What a win counts for, before majors and other bigger events. */
  winIntensity: number;
}

export const TOURS: Tour[] = [
  { id: "pga", name: "PGA Tour", sport: "golf", winIntensity: 0.8 },
  { id: "lpga", name: "LPGA Tour", sport: "golf", winIntensity: 0.8 },
  { id: "eur", name: "DP World Tour", sport: "golf", winIntensity: 0.75 },
  { id: "liv", name: "LIV Golf", sport: "golf", winIntensity: 0.7 },
  { id: "atp", name: "ATP Tour", sport: "tennis", winIntensity: 0.75 },
  { id: "wta", name: "WTA Tour", sport: "tennis", winIntensity: 0.75 },
  { id: "nascar", name: "NASCAR Cup Series", sport: "racing", winIntensity: 0.8 },
  { id: "f1", name: "Formula 1", sport: "racing", winIntensity: 0.85 },
  { id: "indycar", name: "IndyCar", sport: "racing", winIntensity: 0.75 },
];

export const tourById = (id: string) => TOURS.find((t) => t.id === id);

export const toursOf = (sport: TourSport) => TOURS.filter((t) => t.sport === sport);
