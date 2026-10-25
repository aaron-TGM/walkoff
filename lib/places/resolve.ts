// One place from ESPN's {city, state, country}, a line of text ("San
// Clemente, CA", "Holywood, Northern Ireland") or a postal code, or the
// reason there isn't one. It never guesses: a name two places share is
// ambiguous unless one plainly outranks the other.
import { COUNTRIES, haversineKm, normalizeCountry, postalArea, type Country } from "../affinity/geo";
import { regionCode } from "../affinity/regions";
import { loadPlaces, loadZips, type Place, type Zip } from "./data";
import { nameKey } from "./names";

export type Resolved =
  | { status: "found"; place: Place }
  /** Places that share the name, the likeliest first (at most 10). */
  | { status: "ambiguous"; candidates: Place[] }
  /** No place Walkoff knows by that name, there. */
  | { status: "unknown" }
  /** Somewhere Walkoff doesn't cover: only the US, Canada and the UK. */
  | { status: "outside"; country: string };

interface Where {
  country: Country;
  /** State or province code, or the UK nation. */
  region?: string;
}

export const NATIONS: Record<string, string> = { ENG: "England", SCT: "Scotland", WLS: "Wales", NIR: "Northern Ireland" };
const NATION_CODES = new Map(
  Object.entries(NATIONS).flatMap(([code, name]) => [[code.toLowerCase(), code], [name.toLowerCase(), code]]),
);
NATION_CODES.set("n ireland", "NIR");

/** Newspaper short forms of state names: "Calif.", "Wash.", "W.Va.". */
const SHORT_STATES: Record<string, string> = {
  ala: "AL", ariz: "AZ", ark: "AR", cal: "CA", calif: "CA", colo: "CO", conn: "CT", del: "DE",
  fla: "FL", ill: "IL", ind: "IN", kan: "KS", kans: "KS", mass: "MA", mich: "MI", minn: "MN",
  miss: "MS", mont: "MT", neb: "NE", nebr: "NE", nev: "NV", okla: "OK", ore: "OR", oreg: "OR",
  penn: "PA", tenn: "TN", tex: "TX", wash: "WA", wva: "WV", wis: "WI", wisc: "WI", wyo: "WY",
};

const UNKNOWN: Resolved = { status: "unknown" };

/** How much bigger a Canadian or UK place must be than the next one with
 *  its name to be the one meant. */
const DOMINANT = 5;

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** A state, province or UK nation, in the country given or any of them. */
function regionOf(raw: string, country?: Country): Where | null {
  for (const c of country ? [country] : COUNTRIES) {
    const region =
      c === "GB"
        ? NATION_CODES.get(raw.toLowerCase().replace(/\./g, ""))
        : (regionCode(c, raw) ??
          regionCode(c, raw.replace(/[.\s]/g, "")) ??
          (c === "US" ? SHORT_STATES[raw.toLowerCase().replace(/[^a-z]/g, "")] : undefined));
    if (region) return { country: c, region };
  }
  return null;
}

let abroad: Set<string> | undefined;

/** Every country's English name, as name keys, so a town abroad reads as
 *  outside rather than unknown. */
function countryNames(): Set<string> {
  if (!abroad) {
    abroad = new Set();
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const name = names.of(code);
        if (name && name !== code) abroad.add(nameKey(name));
      }
    }
    for (const old of ["Czech Republic", "Ivory Coast", "Holland", "Korea", "Burma", "Swaziland", "Macedonia", "Cape Verde", "Soviet Union", "USSR", "Yugoslavia", "West Germany"]) {
      abroad.add(nameKey(old));
    }
  }
  return abroad;
}

/** A country Walkoff covers, a UK nation or Puerto Rico; "outside" for any
 *  other country; null for text that isn't a country. */
function countryOf(raw: string): Where | "outside" | null {
  const plain = raw.replace(/\./g, "").trim();
  const nation = NATION_CODES.get(plain.toLowerCase());
  if (nation) return { country: "GB", region: nation };
  if (/^(pr|pri|puerto rico)$/i.test(plain)) return { country: "US", region: "PR" };
  const country = normalizeCountry(plain);
  if (country) return { country };
  // ESPN's hockey rosters use three-letter codes: "SWE", "FIN".
  return /^[A-Z]{3}$/.test(plain) || countryNames().has(nameKey(plain)) ? "outside" : null;
}

/** Places with the name, in the country and region when they're known. A
 *  name with "city" or "township" on the end, or "The" in front, is tried
 *  without it too: "New York City" is New York. */
async function lookup(city: string, where?: Where): Promise<Place[]> {
  const shorter = city.replace(/\s+(city|town|township|twp|village|borough|boro|cdp)\.?$/i, "").replace(/^the\s+/i, "");
  for (const key of new Set([nameKey(city), nameKey(shorter)])) {
    if (!key) continue;
    const found: Place[] = [];
    for (const country of where ? [where.country] : COUNTRIES) {
      for (const p of (await loadPlaces(country)).byName.get(key) ?? []) {
        if (!where?.region || p.region === where.region) found.push(p);
      }
    }
    if (found.length) return found;
  }
  return [];
}

/** The one place a name means, or why it can't say. A US name shared
 *  within a state goes to the one place with a government; across states
 *  it's ambiguous. A Canadian or UK one goes to a place five times the size
 *  of the next. */
async function choose(places: Place[]): Promise<Resolved> {
  if (places.length === 0) return UNKNOWN;
  if (places.length === 1) return { status: "found", place: places[0] };
  const weight = new Map<Place, number>();
  for (const p of places) weight.set(p, (await loadPlaces(p.country)).weight.get(p) ?? 0);
  const sorted = [...places].sort((a, b) => weight.get(b)! - weight.get(a)! || a.key.localeCompare(b.key));
  const ambiguous: Resolved = { status: "ambiguous", candidates: sorted.slice(0, 10) };
  const country = places[0].country;
  if (places.some((p) => p.country !== country)) return ambiguous;
  const [first, second] = sorted.map((p) => weight.get(p)!);
  if (country === "US") {
    return new Set(places.map((p) => p.region)).size === 1 && first > second ? { status: "found", place: sorted[0] } : ambiguous;
  }
  return first > 0 && first >= DOMINANT * second ? { status: "found", place: sorted[0] } : ambiguous;
}

/** Where ESPN (or anyone) says someone is from. */
export async function resolvePlace(input: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): Promise<Resolved> {
  const city = clean(input.city);
  const state = clean(input.state);
  const countryText = clean(input.country);
  if (!city) return UNKNOWN;
  // "Chicago, IL" all in the city field.
  if (!state && city.includes(",")) return resolveTown(countryText ? `${city}, ${countryText}` : city);
  let where: Where | undefined;
  if (countryText) {
    const c = countryOf(countryText);
    if (c === "outside") return { status: "outside", country: countryText };
    if (!c) return UNKNOWN;
    where = c;
  }
  if (state) {
    const region = regionOf(state, where?.country);
    if (region) where = region;
    // A region Walkoff can't read (a UK county, an Australian state) with
    // no country to go on: searching everywhere would be a guess.
    else if (!where) return UNKNOWN;
  }
  return choose(await lookup(city, where));
}

/** A town typed by a person or found in a bio: "San Clemente, CA",
 *  "La Jolla, California", "Rancho Santa Fe, CA, USA", "Holywood, Northern
 *  Ireland", or a postal code ("92672", "S7K 1N5", "BT18"), which means the
 *  town at that code's center. */
export async function resolveTown(text: string): Promise<Resolved> {
  const t = clean(text);
  if (!t) return UNKNOWN;
  const coded = await postalTown(t);
  if (coded) return coded;
  const parts = t.split(",").map(clean).filter(Boolean);
  if (parts.length === 1) return choose(await lookup(parts[0]));
  const last = parts[parts.length - 1];
  if (parts.length >= 3) {
    const country = countryOf(last);
    if (country === "outside") return { status: "outside", country: last };
    if (country) return resolvePlace({ city: parts[0], state: parts[1], country: last });
  }
  const region = regionOf(last);
  if (region) return choose(await lookup(parts[0], region));
  return resolvePlace({ city: parts[0], country: last });
}

const found = (place: Place | null): Resolved => (place ? { status: "found", place } : UNKNOWN);

async function postalTown(t: string): Promise<Resolved | null> {
  const s = t.toUpperCase();
  if (/^\d{5}(-\d{4})?$/.test(s)) {
    const zip = (await loadZips()).get(s.slice(0, 5));
    return zip ? found(await zipTown(zip)) : UNKNOWN;
  }
  const compact = s.replace(/\s+/g, "");
  if (/^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(compact)) {
    const area = postalArea("CA", compact.slice(0, 3));
    // A rural area (second character 0) spans too many towns to pick one.
    if (area) return area.code[1] === "0" ? UNKNOWN : found(await nearestPlace("CA", area.lat, area.lng));
  }
  const district = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\s*\d[A-Z]{2})?$/)?.[1];
  const area = district ? postalArea("GB", district) : undefined;
  return area ? found(await nearestPlace("GB", area.lat, area.lng)) : null;
}

export const miles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a, b) / 1.609344;

/** A ZIP's town: the place its postal name means, or else the place at
 *  its center. */
async function zipTown(zip: Zip): Promise<Place | null> {
  const named = zip.name ? await resolvePlace({ city: zip.name, state: zip.region, country: "US" }) : UNKNOWN;
  return named.status === "found" ? named.place : nearby("US", zip.lat, zip.lng, 25);
}

/** The town at a point, within maxMiles, like a high school's coordinates.
 *  In the US, the postal name of the ZIP nearest it; elsewhere, or with no
 *  ZIP near, the smallest town whose reach covers the point, or else the
 *  nearest. */
export async function nearestPlace(country: Country, lat: number, lng: number, maxMiles = 25): Promise<Place | null> {
  if (country === "US") {
    let best: Zip | undefined;
    let bestMiles = maxMiles;
    for (const z of (await loadZips()).values()) {
      if (Math.abs(z.lat - lat) * 69 > bestMiles) continue;
      const d = miles(z, { lat, lng });
      if (d <= bestMiles) {
        best = z;
        bestMiles = d;
      }
    }
    if (best) return zipTown(best);
  }
  return nearby(country, lat, lng, maxMiles);
}

async function nearby(country: Country, lat: number, lng: number, maxMiles: number): Promise<Place | null> {
  const { places } = await loadPlaces(country);
  const dLat = maxMiles / 69;
  const dLng = maxMiles / (69 * Math.cos((lat * Math.PI) / 180));
  let covering: Place | null = null;
  let nearest: Place | null = null;
  let nearestMiles = Infinity;
  for (const p of places) {
    if (p.section || Math.abs(p.lat - lat) > dLat || Math.abs(p.lng - lng) > dLng) continue;
    const d = miles(p, { lat, lng });
    if (d > maxMiles) continue;
    if (d <= Math.max(0.5, p.radius) && (!covering || p.radius < covering.radius)) covering = p;
    if (d < nearestMiles) {
      nearest = p;
      nearestMiles = d;
    }
  }
  return covering ?? nearest;
}

/** A place by its key, as stored on a moment or an athlete's home. */
export async function placeByKey(key: string): Promise<Place | null> {
  for (const country of key.startsWith("geonames:") ? (["CA", "GB"] as const) : (["US"] as const)) {
    const p = (await loadPlaces(country)).byKey.get(key);
    if (p) return p;
  }
  return null;
}

/** "San Clemente, CA", "Saskatoon, SK", "Holywood, Northern Ireland". */
export function placeLabel(p: Place): string {
  return `${p.name}, ${p.country === "GB" ? (NATIONS[p.region] ?? "UK") : p.region}`;
}
