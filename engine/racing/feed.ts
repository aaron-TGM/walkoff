// ESPN racing: each series' current race weekend, and drivers' bios from the
// core API for where they were born. A driver keeps one id across series.
import { getJson } from "../espn/client";
import { coreBio } from "../circuits/bio";
import type { Bio } from "../circuits/poller";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/racing";

/** ESPN's slug for each series Walkoff follows (lib/tours.ts). */
export const RACING_SLUGS: Record<string, string> = { nascar: "nascar-premier", f1: "f1", indycar: "irl" };

export interface EspnRacingStatusType {
  name?: string;
  state?: string;
  completed?: boolean;
  detail?: string;
}

/** The parts of a scoreboard the engine reads. Everything is optional: the
 *  feed is undocumented. */
export interface EspnRacingScoreboard {
  events?: {
    id?: string;
    name?: string;
    date?: string;
    endDate?: string;
    status?: { type?: EspnRacingStatusType };
    /** A race weekend's sessions. NASCAR and IndyCar list only the race;
     *  F1 adds practice, qualifying and sprints. */
    competitions?: {
      id?: string;
      date?: string;
      type?: { abbreviation?: string } | null;
      status?: { type?: EspnRacingStatusType };
      competitors?: {
        id?: string;
        order?: number;
        winner?: boolean;
        athlete?: { displayName?: string; fullName?: string };
      }[];
    }[];
  }[];
}

export interface RacingFeed {
  scoreboard(series: string): Promise<EspnRacingScoreboard>;
  /** Where a driver was born, or null when the bio doesn't say. */
  bio(series: string, externalId: string): Promise<Bio | null>;
}

export function createRacingFeed(options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): RacingFeed {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const slug = (series: string) => RACING_SLUGS[series] ?? series;
  return {
    scoreboard(series) {
      return getJson(`${SITE}/${encodeURIComponent(slug(series))}/scoreboard`, timeoutMs, fetchImpl);
    },
    bio(series, externalId) {
      return coreBio(`racing/leagues/${encodeURIComponent(slug(series))}`, externalId, timeoutMs, fetchImpl);
    },
  };
}
