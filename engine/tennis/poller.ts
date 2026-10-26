// Tennis's tours through the shared poller (engine/circuits/poller.ts): the
// ATP's and the WTA's current tournaments, each singles winner once the
// final is over, and both finalists before it (outcome.ts). See
// engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tour } from "../../lib/tours";
import { CircuitPoller, type Circuit, type CircuitPollerOptions } from "../circuits/poller";
import type { TennisFeed } from "./feed";
import { normalizeTennis, type TennisEvent } from "./normalize";
import { tennisOutcomes } from "./outcome";

export function tennisCircuit(tour: Tour, feed: TennisFeed): Circuit<TennisEvent> {
  return {
    tour,
    events: async () => normalizeTennis(tour.id, await feed.scoreboard(tour.id)),
    outcomes: (e, now) => tennisOutcomes(e, tour, now),
    bio: (id) => feed.bio(tour.id, id),
  };
}

export class TennisPoller extends CircuitPoller<TennisEvent> {
  constructor(tour: Tour, db: SupabaseClient, feed: TennisFeed, options: CircuitPollerOptions) {
    super(tennisCircuit(tour, feed), db, options);
  }
}
