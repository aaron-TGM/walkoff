// A circle around a town for a hometown campaign, and how many of a
// brand's customers it likely holds. Klaviyo's segment ("within N miles of
// a postal code") gives the real count; these are estimates from where the
// brand's customers are, by postal area.
import type { AreaCount } from "../affinity/compute";
import { POSTAL_AREAS, postalArea, type Country } from "../affinity/geo";
import { loadZips, type Place } from "./data";
import { miles } from "./resolve";

export const CIRCLE = {
  /** Radii Walkoff picks from, in miles. */
  radii: [3, 5, 8, 10, 15, 20, 25],
  /** The smallest circle that holds this many people, so there's an audience. */
  minPeople: 75_000,
  /** And covers the whole town: this many times its reach. */
  cover: 1.2,
  /** More people than this inside, and it's a big city, not a town. */
  bigCity: 750_000,
  /** A radius asked for is kept inside these. */
  minMiles: 1,
  maxMiles: 50,
};

export interface TownCircle {
  country: Country;
  /** The postal code Klaviyo centers the circle on. */
  ref: string;
  /** Where Walkoff counts from: that code's center, as Klaviyo places it. */
  lat: number;
  lng: number;
  radiusMiles: number;
  /** People inside, estimated. */
  population: number;
  /** More than 750,000 people inside. Hometown moments there need an
   *  operator or the curated file to have set the home. */
  bigCity: boolean;
  /** The share of each postal area's people inside the circle, by area key
   *  ("US:926"). Customers are known only by area, so this is how they're
   *  counted. */
  shares: Record<string, number>;
  /** How the shares were worked out, for anyone reading the estimate. */
  method: string;
}

const COUNTRY_PEOPLE = new Map<Country, number>();
for (const a of POSTAL_AREAS) COUNTRY_PEOPLE.set(a.country, (COUNTRY_PEOPLE.get(a.country) ?? 0) + a.population);

/** The smallest radius that holds enough people and covers the town. */
function pick(people: (radius: number) => number, reach: number): number {
  for (const r of CIRCLE.radii) {
    if (r >= CIRCLE.cover * reach && people(r) >= CIRCLE.minPeople) return r;
  }
  return CIRCLE.radii[CIRCLE.radii.length - 1];
}

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

/** The circle for a town, or at radiusMiles when one's asked for. */
export async function townCircle(place: Place, options: { radiusMiles?: number } = {}): Promise<TownCircle> {
  const asked = options.radiusMiles
    ? Math.min(CIRCLE.maxMiles, Math.max(CIRCLE.minMiles, options.radiusMiles))
    : undefined;
  const widest = asked ?? CIRCLE.radii[CIRCLE.radii.length - 1];
  return place.country === "US" ? usCircle(place, asked, widest) : areaCircle(place, asked, widest);
}

/** US: ZIP populations, so a circle takes the part of each 3-digit area
 *  that's inside it. */
async function usCircle(place: Place, asked: number | undefined, widest: number): Promise<TownCircle> {
  const zips = await loadZips();
  const center = zips.get(place.ref) ?? place;
  const near: { area: string; d: number; people: number }[] = [];
  for (const z of zips.values()) {
    // A degree of latitude is 69 miles; skip what's plainly too far first.
    if (Math.abs(z.lat - center.lat) * 69 > widest) continue;
    const d = miles(center, z);
    if (d <= widest) near.push({ area: z.zip.slice(0, 3), d, people: z.population });
  }
  const people = (r: number) => near.reduce((s, z) => (z.d <= r ? s + z.people : s), 0);
  const radius = asked ?? pick(people, place.radius);
  const inside = new Map<string, number>();
  for (const z of near) if (z.d <= radius) inside.set(z.area, (inside.get(z.area) ?? 0) + z.people);
  const shares: Record<string, number> = {};
  for (const [area, n] of inside) {
    const total = postalArea("US", area)?.population;
    if (total) shares[`US:${area}`] = round(Math.min(1, n / total), 4);
  }
  const population = people(radius);
  return {
    country: "US",
    ref: place.ref,
    lat: center.lat,
    lng: center.lng,
    radiusMiles: radius,
    population,
    bigCity: population > CIRCLE.bigCity,
    shares,
    method: "Each 3-digit ZIP area's customers times the share of its people in ZIP codes inside the circle.",
  };
}

/** Canada and the UK: whole postal areas whose centers are inside. A rural
 *  Canadian area (second character 0) spans far more than any town, so a
 *  quarter of it counts. The UK's circle sits on the code's district,
 *  which is all of a UK code Klaviyo reads. */
async function areaCircle(place: Place, asked: number | undefined, widest: number): Promise<TownCircle> {
  const country = place.country;
  const own = country === "CA" ? place.ref.slice(0, 3) : place.ref.split(" ")[0];
  const district = country === "GB" ? postalArea("GB", own) : undefined;
  const center = district ?? place;
  const weight = (code: string) => (country === "CA" && code[1] === "0" ? 0.25 : 1);
  const near = POSTAL_AREAS.filter((a) => a.country === country)
    .map((a) => ({ a, d: a.code === own ? 0 : miles(center, a) }))
    .filter((x) => x.d <= widest);
  const people = (r: number) => near.reduce((s, x) => (x.d <= r ? s + weight(x.a.code) * x.a.population : s), 0);
  const radius = asked ?? pick(people, place.radius);
  const shares: Record<string, number> = {};
  for (const x of near) if (x.d <= radius) shares[x.a.key] = weight(x.a.code);
  const population = Math.round(people(radius));
  return {
    country,
    ref: place.ref,
    lat: center.lat,
    lng: center.lng,
    radiusMiles: radius,
    population,
    bigCity: population > CIRCLE.bigCity,
    shares,
    method:
      country === "CA"
        ? "Customers in the forward sortation areas whose centers are inside the circle (a quarter of a rural one's)."
        : "Customers in the postcode districts whose centers are inside the circle.",
  };
}

function inCircle(circle: TownCircle, counts: AreaCount[]): number {
  let n = 0;
  for (const c of counts) n += (circle.shares[`${c.country}:${c.area}`] ?? 0) * Math.max(0, Number(c.customers) || 0);
  return n;
}

/** About how many of the brand's customers live inside the circle. */
export function townCustomers(circle: TownCircle, counts: AreaCount[]): number {
  return Math.round(inCircle(circle, counts));
}

/** How much more of the brand's customers live in the circle than its
 *  share of the country's people: 2 means twice as many as expected. Null
 *  when the brand has no customers in that country. */
export function townLift(circle: TownCircle, counts: AreaCount[]): number | null {
  const inCountry = counts
    .filter((c) => c.country === circle.country && postalArea(c.country, c.area))
    .reduce((s, c) => s + Math.max(0, Number(c.customers) || 0), 0);
  const people = COUNTRY_PEOPLE.get(circle.country);
  if (!inCountry || !people || circle.population <= 0) return null;
  return round(inCircle(circle, counts) / inCountry / (circle.population / people), 2);
}
