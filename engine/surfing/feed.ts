// Surfing's Championship Tour, from Wikipedia. The World Surf League's own
// site has no feed, and its robots.txt shuts out AI agents. The season's
// article ("2026 World Surf League") lists each event's dates and, once
// it's over, its champions and runners-up. Walkoff reads only those facts.
// The raw text comes from Wikipedia's cache, so a poll costs it little.
// Where surfers were born comes from Wikidata, by their articles.
import { fetchBirthplaces, type WikidataPlace } from "../athletes/wikidata";

const RAW = "https://en.wikipedia.org/w/index.php";
/** Wikimedia asks every client to say who it is. */
const USER_AGENT = "WalkoffEngine/1.0 (https://www.walkoff.io)";

export const seasonTitle = (year: number) => `${year} World Surf League`;

export interface SurfingFeed {
  /** The season article's wikitext, or null when there isn't one yet. */
  season(year: number): Promise<string | null>;
  /** Where surfers were born, by their English Wikipedia article. A title
   *  Wikidata doesn't know isn't in the map. */
  birthplaces(titles: string[]): Promise<Map<string, { item: string; birthplace: WikidataPlace | null }>>;
}

export function createSurfingFeed(options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): SurfingFeed {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async season(year) {
      const title = encodeURIComponent(seasonTitle(year).replace(/ /g, "_"));
      const res = await fetchImpl(`${RAW}?title=${title}&action=raw`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": USER_AGENT },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} from Wikipedia`);
      return res.text();
    },
    birthplaces: (titles) => fetchBirthplaces(titles, { timeoutMs: 30_000, fetchImpl }),
  };
}
