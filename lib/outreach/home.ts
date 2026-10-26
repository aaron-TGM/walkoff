// A prospect's home teams: the teams most fans follow where the store is
// based, which Store Leads gives as the headquarters. A cold pitch can't
// know where a brand's customers live. Its hometown is the best guess, and
// the brand's own map, once it connects, is the answer.
// Server-only: it reads lib/places.
import { haversineKm, normalizeCountry, POSTAL_AREAS, postalArea, toPostalArea, type Country, type PostalArea } from "../affinity/geo";
import { LEAGUE_COUNTRIES, sharesForArea } from "../affinity/territories";
import { LEAGUES } from "../leagues";
import { LEAGUE_ORDER, teamByKey } from "../mcp/teams";
import { resolvePlace } from "../places";

export interface HomeTeam {
  /** "nfl:24" */
  key: string;
  name: string;
  /** Share of the area's fans of the league, 0 to 1. */
  share: number;
}

export interface Located {
  area: PostalArea | null;
  how: "coordinates" | "postal code" | "city" | "unplaced";
}

export interface ProspectPlace {
  country: string | null;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
}

/** Leagues that are playing: the site notes the ones that aren't yet
 *  ("Opening Day 2027"). */
export const PITCH_LEAGUES = LEAGUES.filter((l) => !l.note).map((l) => l.id);

/** A second team counts as home where it holds this share of fans (LA's
 *  Rams and Chargers, New York's Giants and Jets). */
const SHARED_MARKET = 0.3;

/** Farther than this from every area's center, a point isn't in one. */
const MAX_KM = 150;

const BY_COUNTRY = new Map<Country, PostalArea[]>(
  (["US", "CA", "GB"] as const).map((c) => [c, POSTAL_AREAS.filter((a) => a.country === c)]),
);

export function nearestArea(lat: number, lng: number, country?: Country | null): PostalArea | null {
  let best: PostalArea | null = null;
  let bestKm = MAX_KM;
  const dLat = MAX_KM / 111;
  for (const c of country ? [country] : (["US", "CA", "GB"] as const)) {
    for (const a of BY_COUNTRY.get(c) ?? []) {
      if (Math.abs(a.lat - lat) > dLat) continue;
      const km = haversineKm(a, { lat, lng });
      if (km < bestKm) {
        best = a;
        bestKm = km;
      }
    }
  }
  return best;
}

/** The postal area the store is based in, from its coordinates, its
 *  postal code or its city, best first. Outside the US, Canada and the UK
 *  there's none. */
export async function locate(p: ProspectPlace): Promise<Located> {
  const named = p.country ? normalizeCountry(p.country) : undefined;
  if (named === null) return { area: null, how: "unplaced" };
  if (p.lat !== null && p.lng !== null && !(p.lat === 0 && p.lng === 0)) {
    const area = nearestArea(p.lat, p.lng, named);
    if (area) return { area, how: "coordinates" };
  }
  const coded = p.postal_code ? toPostalArea(p.postal_code, named) : null;
  const byCode = coded ? postalArea(coded.country, coded.code) : undefined;
  if (byCode) return { area: byCode, how: "postal code" };
  if (p.city) {
    const r = await resolvePlace({ city: p.city, state: p.region, country: named ?? p.country });
    if (r.status === "found") {
      const area = nearestArea(r.place.lat, r.place.lng, r.place.country);
      if (area) return { area, how: "city" };
    }
  }
  return { area: null, how: "unplaced" };
}

const COLLEGE = ["ncaaf", "ncaab"];

/** The teams most fans follow in the area, one per league (two in a shared
 *  market), in the order leagues are listed everywhere else. A school
 *  counts once, by its first league: teamKeys gives the other. */
export function homeTeams(area: PostalArea, leagues: string[] = PITCH_LEAGUES): HomeTeam[] {
  const out: HomeTeam[] = [];
  const schools = new Set<string>();
  for (const league of LEAGUE_ORDER) {
    if (!leagues.includes(league) || !LEAGUE_COUNTRIES[league]?.includes(area.country)) continue;
    for (const [i, s] of sharesForArea(league, area).entries()) {
      if (i > 0 && s.share < SHARED_MARKET) continue;
      if (COLLEGE.includes(league)) {
        if (schools.has(s.team.id)) continue;
        schools.add(s.team.id);
      }
      out.push({ key: `${league}:${s.team.id}`, name: s.team.name, share: Math.round(s.share * 100) / 100 });
    }
  }
  return out;
}

/** Every key a home team goes by: a school's football and basketball
 *  teams share colors, fans and an id ("ncaaf:26", "ncaab:26"). */
export function teamKeys(key: string): string[] {
  const [league, id] = key.split(":");
  return COLLEGE.includes(league) ? COLLEGE.map((l) => `${l}:${id}`).filter((k) => k === key || teamByKey(k)) : [key];
}
