// Postal areas and team homes, built by scripts/build-geo.ts and
// scripts/build-teams.ts. See data/geo/README.md for sources.
import postal from "../../data/geo/postal-areas.json";
import homes from "../../data/geo/team-homes.json";

export type Country = "US" | "CA" | "GB";
export const COUNTRIES: Country[] = ["US", "CA", "GB"];

/** A US 3-digit ZIP prefix, a Canadian forward sortation area or a UK
 *  postcode district. Never finer than that: it's all Walkoff stores. */
export interface PostalArea {
  key: string;
  country: Country;
  code: string;
  lat: number;
  lng: number;
  population: number;
  /** State, province, or UK nation. */
  region: string;
  /** The full postal code nearest the area's center: "92108", "M5V 1K5",
   *  "N17 6RX". For tools that need a real code, like Klaviyo's "within N
   *  miles of" segment condition (which reads only a UK code's district). */
  ref: string;
}

export interface TeamHome {
  id: string;
  abbr: string;
  name: string;
  /** "Philadelphia" / "Eagles"; "Michigan" / "Wolverines". */
  location: string;
  nickname: string;
  country: Country;
  region: string;
  lat: number;
  lng: number;
  weight: number;
  reach: number;
  regions: string[];
  /** Places the team left that still follow it, with the share of its pull
   *  it keeps there. */
  homes: { lat: number; lng: number; weight: number }[];
  /** Team colors as hex, main color first. */
  colors: string[];
}

type Row = [string, number, number, number, string, string];

export const POSTAL_AREAS: PostalArea[] = COUNTRIES.flatMap((country) =>
  (postal.areas[country] as Row[]).map(([code, lat, lng, population, region, ref]) => ({
    key: `${country}:${code}`,
    country,
    code,
    lat,
    lng,
    population,
    region,
    ref,
  })),
);

const BY_KEY = new Map(POSTAL_AREAS.map((a) => [a.key, a]));

export function postalArea(country: Country, code: string): PostalArea | undefined {
  return BY_KEY.get(`${country}:${code}`);
}

export const TEAM_HOMES = homes.leagues as Record<string, TeamHome[]>;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Cuts a raw postal code down to the area Walkoff stores. Returns null when
 * it can't tell which country or area the code belongs to.
 *   US "19147-1234" -> 191, "2035" (Excel dropped the zero) -> 020, "191" -> 191
 *   CA "m5v 3l9" -> M5V
 *   GB "n17 0ap" -> N17, "N170AP" -> N17, "N17" -> N17
 */
export function toPostalArea(
  rawCode: string,
  rawCountry?: string | null,
): { country: Country; code: string } | null {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  // A country we don't cover (France, say) means skip it, not guess from
  // the code's shape: 75001 isn't a US ZIP when the row says Paris.
  const named = rawCountry?.trim() ? normalizeCountry(rawCountry) : undefined;
  if (named === null) return null;
  const country = named ?? guessCountry(code);
  if (country === "US") {
    const digits = code.replace(/[^0-9]/g, "").slice(0, 5);
    if (digits.length < 3) return null;
    // Three digits is an area already: "921" is San Diego, not 00921.
    const zip = digits.length === 4 ? `0${digits}` : digits;
    return { country, code: zip.slice(0, 3) };
  }
  if (country === "CA") {
    const fsa = code.replace(/\s+/g, "").slice(0, 3);
    return /^[A-Z][0-9][A-Z]$/.test(fsa) ? { country, code: fsa } : null;
  }
  if (country === "GB") {
    const compact = code.replace(/\s+/g, "");
    // A district on its own ("N17", "SW1A") is an area already.
    const outward = code.includes(" ") ? code.split(/\s+/)[0] : DISTRICT.test(compact) ? compact : compact.slice(0, -3);
    return DISTRICT.test(outward) ? { country, code: outward } : null;
  }
  return null;
}

/** "USA", "Canada", "UK" and the like as the country Walkoff covers, or null
 *  for one it doesn't. */
export function normalizeCountry(raw?: string | null): Country | null {
  const c = raw?.trim().toUpperCase();
  if (!c) return null;
  if (["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(c)) return "US";
  if (["CA", "CAN", "CANADA"].includes(c)) return "CA";
  if (["GB", "UK", "GBR", "UNITED KINGDOM", "GREAT BRITAIN", "ENGLAND", "SCOTLAND", "WALES", "NORTHERN IRELAND"].includes(c)) {
    return "GB";
  }
  return null;
}

const DISTRICT = /^[A-Z]{1,2}[0-9][A-Z0-9]?$/;

function guessCountry(code: string): Country | null {
  if (/^\d{3,5}(-\d{4})?$/.test(code)) return "US";
  if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(code)) return "CA";
  if (/^[A-Z]{1,2}\d[A-Z0-9]?\s?\d[A-Z]{2}$/.test(code)) return "GB";
  // An area on its own, like "M5V" or "N17", if only one country has it.
  const found = COUNTRIES.filter((c) => c !== "US" && postalArea(c, code));
  return found.length === 1 ? found[0] : null;
}
