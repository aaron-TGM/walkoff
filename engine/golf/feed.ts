// ESPN golf: each tour's current leaderboard, and golfers' bios for where
// they were born. Golfers keep one id on every tour, and a bio reads the
// same through any tour's path.
import { getJson } from "../espn/client";

const WEB = "https://site.web.api.espn.com/apis";

/** The parts of a leaderboard the engine reads. Everything is optional:
 *  the feed is undocumented. */
export interface EspnGolfLeaderboard {
  events?: {
    id?: string;
    name?: string;
    date?: string;
    endDate?: string;
    status?: { type?: EspnGolfStatusType };
    tournament?: { major?: boolean; numberOfRounds?: number };
    competitions?: {
      status?: { period?: number; type?: EspnGolfStatusType };
      competitors?: {
        id?: string;
        sortOrder?: number;
        status?: {
          period?: number;
          teeTime?: string;
          playoff?: boolean;
          type?: EspnGolfStatusType;
          position?: { displayName?: string; isTie?: boolean };
        };
        score?: { value?: number; displayValue?: string } | string;
        linescores?: { period?: number; value?: number; teeTime?: string }[];
        athlete?: { id?: string; displayName?: string };
      }[];
    }[];
  }[];
}

export interface EspnGolfStatusType {
  name?: string;
  state?: string;
  completed?: boolean;
  detail?: string;
}

export interface GolfBio {
  city: string;
  state: string;
  country: string;
}

export interface GolfFeed {
  leaderboard(tour: string): Promise<EspnGolfLeaderboard>;
  /** Where a golfer was born, or null when the bio doesn't say. */
  bio(externalId: string): Promise<GolfBio | null>;
}

const text = (s: string | undefined) => s?.trim() ?? "";

/** A bio's birthplace. Golf bios pad the state with spaces. */
export function parseBio(json: unknown): GolfBio | null {
  const b = (json as { athlete?: { birthPlace?: { city?: string; state?: string; country?: string } } })?.athlete?.birthPlace;
  const city = text(b?.city);
  return city ? { city, state: text(b?.state), country: text(b?.country) } : null;
}

export function createGolfFeed(options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): GolfFeed {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    leaderboard(tour) {
      return getJson(`${WEB}/site/v2/sports/golf/leaderboard?league=${encodeURIComponent(tour)}`, timeoutMs, fetchImpl);
    },
    async bio(externalId) {
      return parseBio(await getJson(`${WEB}/common/v3/sports/golf/pga/athletes/${encodeURIComponent(externalId)}`, timeoutMs, fetchImpl));
    },
  };
}
