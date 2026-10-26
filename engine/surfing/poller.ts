// Surfing's Championship Tour through the shared poller
// (engine/circuits/poller.ts): the season's events from Wikipedia, their
// champions once the article names them (outcome.ts), and where surfers were
// born from Wikidata. ESPN doesn't know surfers, so their ids are Walkoff's
// own, the same create_moment gives: "walkoff:surfing:griffin-colapinto".
// See engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugOf } from "../../lib/athletes";
import type { Tour } from "../../lib/tours";
import { locatePlace } from "../athletes/wikidata";
import { CircuitPoller, type Circuit, type CircuitPollerOptions } from "../circuits/poller";
import type { SurfingFeed } from "./feed";
import { parseSeason, type SurfEvent } from "./normalize";
import { SURFING, surfingOutcome } from "./outcome";

/** Walkoff's id for a surfer, from their article's title: "Leonardo
 *  Fioravanti (surfer)" is "walkoff:surfing:leonardo-fioravanti". */
export const surferId = (title: string) => `walkoff:surfing:${slugOf(title.replace(/\s*\([^)]*\)$/, ""))}`;

export function surfingCircuit(tour: Tour, feed: SurfingFeed, options: Pick<CircuitPollerOptions, "now"> = {}): Circuit<SurfEvent> {
  const now = options.now ?? Date.now;
  /** When the article first named each event's champions. */
  const named = new Map<string, Map<string, number>>();
  return {
    tour,
    athleteId: surferId,
    async events() {
      const year = new Date(now()).getUTCFullYear();
      const text = await feed.season(year);
      return text ? parseSeason(text, year) : [];
    },
    outcomes(e, at) {
      // Champions the article has named for a while, not a moment ago.
      const before = named.get(e.key) ?? new Map<string, number>();
      const since = new Map(e.champions.map((c) => [c.externalId, before.get(c.externalId) ?? at]));
      named.set(e.key, since);
      const settled = e.champions.filter((c) => at - since.get(c.externalId)! >= SURFING.settle);
      const o = surfingOutcome(e, tour, at, settled);
      return o ? [o] : [];
    },
    async bio(title) {
      const found = (await feed.birthplaces([title])).get(title);
      if (!found?.birthplace) return null;
      return { city: found.birthplace.name, state: "", country: "", source: "wikidata", resolved: await locatePlace(found.birthplace) };
    },
  };
}

export class SurfingPoller extends CircuitPoller<SurfEvent> {
  constructor(tour: Tour, db: SupabaseClient, feed: SurfingFeed, options: CircuitPollerOptions) {
    super(surfingCircuit(tour, feed, options), db, options);
  }
}
