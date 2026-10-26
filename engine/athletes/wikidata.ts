// Wikidata (free to use, CC0) links ESPN's athlete ids to high schools and
// birthplaces, with coordinates: it's how Walkoff learns that Sam Darnold
// went to San Clemente High School. It also says how well known an athlete
// is: how many Wikimedia sites have a page about them. For athletes ESPN
// doesn't know (surfers), it finds them by their English Wikipedia
// article. Its query service limits callers hard, so the sync asks for one
// batch at a time and backs off when told to.
import type { Country } from "../../lib/affinity/geo";
import { nearestPlace, resolvePlace, type Place, type Resolved } from "../../lib/places";

const ENDPOINT = "https://query.wikidata.org/sparql";
/** Wikimedia asks every client to say who it is. */
const USER_AGENT = "WalkoffEngine/1.0 (https://www.walkoff.io)";

/** Wikidata's property for each league's ESPN player ids. */
export const ESPN_PROPERTIES: Record<string, string> = {
  nfl: "P3686",
  ncaaf: "P7262",
  nba: "P3685",
  nhl: "P3687",
  mlb: "P3571",
  epl: "P3681",
};

const COUNTRIES: Record<string, Country> = { Q30: "US", Q16: "CA", Q145: "GB" };

export interface WikidataPlace {
  name: string;
  lat: number | null;
  lng: number | null;
  /** A country Walkoff covers, "outside" for any other, null when
   *  Wikidata doesn't say. */
  country: Country | "outside" | null;
}

export interface WikidataAthlete {
  externalId: string;
  /** "Q27049069". */
  item: string;
  school: WikidataPlace | null;
  birthplace: WikidataPlace | null;
  /** Wikimedia sites with a page about them, Wikipedias mostly. */
  sitelinks: number | null;
}

/** Wikidata asked Walkoff to slow down (HTTP 429 or 503). */
export class WikidataBusy extends Error {
  constructor(
    readonly status: number,
    /** Seconds Wikidata asked for, when it said. */
    readonly retryAfter: number | null,
  ) {
    super(`Wikidata is busy (HTTP ${status})`);
  }
}

/** Each athlete's item and its count of pages, any secondary school (high
 *  schools included) with its coordinates, and the birthplace. */
export function lookupQuery(property: string, ids: string[]): string {
  if (!/^P\d+$/.test(property)) throw new Error(`Not a Wikidata property: ${property}`);
  const values = ids.filter((id) => /^\d+$/.test(id)).map((id) => `"${id}"`).join(" ");
  return `SELECT ?espn ?item ?sitelinks ?school ?schoolLabel ?schoolCoord ?schoolCountry ?birth ?birthLabel ?birthCoord ?birthCountry WHERE {
  VALUES ?espn { ${values} }
  ?item wdt:${property} ?espn .
  OPTIONAL { ?item wikibase:sitelinks ?sitelinks . }
  OPTIONAL {
    ?item wdt:P69 ?school .
    ?school wdt:P31/wdt:P279* wd:Q159334 .
    ?school wdt:P625 ?schoolCoord .
    OPTIONAL { ?school wdt:P17 ?schoolCountry . }
  }
  OPTIONAL {
    ?item wdt:P19 ?birth .
    OPTIONAL { ?birth wdt:P625 ?birthCoord . }
    OPTIONAL { ?birth wdt:P17 ?birthCountry . }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

type Binding = Record<string, { value: string } | undefined>;

const qid = (uri: string | undefined) => uri?.split("/").pop() ?? "";

/** "Point(-117.6159 33.4406)" as a lat and lng. */
function point(wkt: string | undefined): { lat: number; lng: number } | null {
  const m = wkt?.match(/^Point\(([-\d.eE]+) ([-\d.eE]+)\)$/);
  return m ? { lat: Number(m[2]), lng: Number(m[1]) } : null;
}

function place(b: Binding, prefix: "school" | "birth"): WikidataPlace | null {
  if (!b[prefix]) return null;
  const at = point(b[`${prefix}Coord`]?.value);
  const country = b[`${prefix}Country`]?.value;
  return {
    name: b[`${prefix}Label`]?.value ?? qid(b[prefix]?.value),
    lat: at?.lat ?? null,
    lng: at?.lng ?? null,
    country: country ? (COUNTRIES[qid(country)] ?? "outside") : null,
  };
}

/** One row per athlete. With more than one school on file, the one
 *  nearest the birthplace, where they most likely grew up. */
export function parseLookup(json: unknown): WikidataAthlete[] {
  const bindings = (json as { results?: { bindings?: Binding[] } })?.results?.bindings ?? [];
  const byId = new Map<string, Binding[]>();
  for (const b of bindings) {
    const id = b.espn?.value;
    if (id) byId.set(id, [...(byId.get(id) ?? []), b]);
  }
  const out: WikidataAthlete[] = [];
  for (const [externalId, rows] of byId) {
    const sorted = [...rows].sort((a, b) => qid(a.school?.value).localeCompare(qid(b.school?.value)) || qid(a.birth?.value).localeCompare(qid(b.birth?.value)));
    const withBirth = sorted.find((r) => r.birth);
    const birthplace = withBirth ? place(withBirth, "birth") : null;
    const schools = sorted.map((r) => place(r, "school")).filter((s): s is WikidataPlace => s !== null && s.lat !== null);
    const away = (s: WikidataPlace) =>
      birthplace?.lat != null && birthplace.lng != null ? (s.lat! - birthplace.lat) ** 2 + (s.lng! - birthplace.lng) ** 2 : 0;
    const school = schools.reduce<WikidataPlace | null>((best, s) => (!best || away(s) < away(best) ? s : best), null);
    const pages = Number(sorted[0].sitelinks?.value);
    out.push({ externalId, item: qid(sorted[0].item?.value), school, birthplace, sitelinks: sorted[0].sitelinks && Number.isInteger(pages) ? pages : null });
  }
  return out.sort((a, b) => a.externalId.localeCompare(b.externalId));
}

export interface WikidataClient {
  lookup(league: string, ids: string[]): Promise<WikidataAthlete[]>;
}

/** The town a Wikidata place is in: by its coordinates, or by its name
 *  when it has none. */
export async function locatePlace(
  p: WikidataPlace,
  options: { locate?: typeof nearestPlace; resolve?: (b: { city: string; state: string; country: string }) => Promise<Resolved> } = {},
): Promise<Resolved> {
  if (p.country === "outside") return { status: "outside", country: "" };
  if (!p.country) return { status: "unknown" };
  if (p.lat !== null && p.lng !== null) {
    const place: Place | null = await (options.locate ?? nearestPlace)(p.country, p.lat, p.lng);
    return place ? { status: "found", place } : { status: "unknown" };
  }
  return (options.resolve ?? resolvePlace)({ city: p.name, state: "", country: p.country });
}

/** Birthplaces by English Wikipedia article title, like "Griffin
 *  Colapinto" or "Leonardo Fioravanti (surfer)". */
export function birthplacesQuery(titles: string[]): string {
  const values = titles.map((t) => `"${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@en`).join(" ");
  return `SELECT ?title ?item ?birth ?birthLabel ?birthCoord ?birthCountry WHERE {
  VALUES ?title { ${values} }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL {
    ?item wdt:P19 ?birth .
    OPTIONAL { ?birth wdt:P625 ?birthCoord . }
    OPTIONAL { ?birth wdt:P17 ?birthCountry . }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

/** Each title Wikidata knows, with the birthplace (null when it doesn't
 *  say). A title it doesn't know isn't in the map. */
export function parseBirthplaces(json: unknown): Map<string, { item: string; birthplace: WikidataPlace | null }> {
  const out = new Map<string, { item: string; birthplace: WikidataPlace | null }>();
  for (const b of (json as { results?: { bindings?: Binding[] } })?.results?.bindings ?? []) {
    const title = b.title?.value;
    if (!title) continue;
    const birthplace = place(b, "birth");
    const had = out.get(title);
    // More than one birthplace on file: the first, by item id, so it's stable.
    if (!had || (!had.birthplace && birthplace)) out.set(title, { item: qid(b.item?.value), birthplace });
  }
  return out;
}

export async function fetchBirthplaces(
  titles: string[],
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<Map<string, { item: string; birthplace: WikidataPlace | null }>> {
  if (!titles.length) return new Map();
  const res = await (options.fetchImpl ?? fetch)(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    headers: {
      accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
    },
    body: new URLSearchParams({ query: birthplacesQuery(titles) }).toString(),
  });
  if (res.status === 429 || res.status === 503) {
    const after = Number(res.headers.get("retry-after"));
    throw new WikidataBusy(res.status, Number.isFinite(after) && after > 0 ? after : null);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} from Wikidata`);
  return parseBirthplaces(await res.json());
}

export function createWikidataClient(options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): WikidataClient {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async lookup(league, ids) {
      const property = ESPN_PROPERTIES[league];
      if (!property || ids.length === 0) return [];
      const res = await fetchImpl(ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "application/sparql-results+json",
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": USER_AGENT,
        },
        body: new URLSearchParams({ query: lookupQuery(property, ids) }).toString(),
      });
      if (res.status === 429 || res.status === 503) {
        const after = Number(res.headers.get("retry-after"));
        throw new WikidataBusy(res.status, Number.isFinite(after) && after > 0 ? after : null);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from Wikidata`);
      return parseLookup(await res.json());
    },
  };
}
