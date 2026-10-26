// Golf's tours through the shared poller (engine/circuits/poller.ts): each
// tour's current leaderboard, its winner once the event is final, and
// whoever leads going into the final round (outcome.ts). See
// engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tour } from "../../lib/tours";
import { CIRCUIT_POLL, CircuitPoller, type Circuit, type CircuitPollerOptions } from "../circuits/poller";
import type { GolfFeed } from "./feed";
import { normalizeLeaderboard } from "./normalize";
import { golfOutcome } from "./outcome";
import type { GolfEvent } from "./types";

export const GOLF_POLL = CIRCUIT_POLL;

export function golfCircuit(tour: Tour, feed: GolfFeed): Circuit<GolfEvent> {
  return {
    tour,
    events: async () => normalizeLeaderboard(tour.id, await feed.leaderboard(tour.id)),
    outcomes: (e, now) => {
      const o = golfOutcome(e, tour, now);
      return o ? [o] : [];
    },
    bio: (id) => feed.bio(id),
  };
}

export class GolfPoller extends CircuitPoller<GolfEvent> {
  constructor(tour: Tour, db: SupabaseClient, feed: GolfFeed, options: CircuitPollerOptions) {
    super(golfCircuit(tour, feed), db, options);
  }
}
