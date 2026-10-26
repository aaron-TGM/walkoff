// Racing's series through the shared poller (engine/circuits/poller.ts):
// NASCAR's Cup Series, Formula 1 and IndyCar, each series' current race
// weekend and its winner once the race is final (outcome.ts). See
// engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tour } from "../../lib/tours";
import { CircuitPoller, type Circuit, type CircuitPollerOptions } from "../circuits/poller";
import type { RacingFeed } from "./feed";
import { normalizeRaces, type Race } from "./normalize";
import { raceOutcome } from "./outcome";

export function racingCircuit(tour: Tour, feed: RacingFeed): Circuit<Race> {
  return {
    tour,
    events: async () => normalizeRaces(tour.id, await feed.scoreboard(tour.id)),
    outcomes: (r, now) => {
      const o = raceOutcome(r, tour, now);
      return o ? [o] : [];
    },
    bio: (id) => feed.bio(tour.id, id),
  };
}

export class RacingPoller extends CircuitPoller<Race> {
  constructor(tour: Tour, db: SupabaseClient, feed: RacingFeed, options: CircuitPollerOptions) {
    super(racingCircuit(tour, feed), db, options);
  }
}
