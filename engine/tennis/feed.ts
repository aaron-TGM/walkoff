// ESPN tennis: each tour's current tournaments with their draws, and
// players' bios from the core API for where they were born.
import { getJson } from "../espn/client";
import { coreBio } from "../circuits/bio";
import type { Bio } from "../circuits/poller";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/tennis";

export interface EspnTennisStatusType {
  name?: string;
  state?: string;
  completed?: boolean;
  detail?: string;
}

/** The parts of a scoreboard the engine reads. Everything is optional: the
 *  feed is undocumented. */
export interface EspnTennisScoreboard {
  events?: {
    id?: string;
    name?: string;
    date?: string;
    endDate?: string;
    /** True for a Grand Slam. */
    major?: boolean;
    status?: { type?: EspnTennisStatusType };
    /** The draws: men's and women's singles and doubles. */
    groupings?: {
      grouping?: { slug?: string; displayName?: string };
      competitions?: {
        id?: string;
        date?: string;
        round?: { displayName?: string };
        status?: { type?: EspnTennisStatusType };
        competitors?: { id?: string; winner?: boolean; athlete?: { displayName?: string } }[];
      }[];
    }[];
  }[];
}

export interface TennisFeed {
  scoreboard(tour: string): Promise<EspnTennisScoreboard>;
  /** Where a player was born, or null when the bio doesn't say. */
  bio(tour: string, externalId: string): Promise<Bio | null>;
}

export function createTennisFeed(options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): TennisFeed {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    scoreboard(tour) {
      return getJson(`${SITE}/${encodeURIComponent(tour)}/scoreboard`, timeoutMs, fetchImpl);
    },
    bio(tour, externalId) {
      return coreBio(`tennis/leagues/${encodeURIComponent(tour)}`, externalId, timeoutMs, fetchImpl);
    },
  };
}
