// Who to send to: a team's fan territory, written as a Klaviyo segment.
// Klaviyo's zip filter takes whole codes and its proximity condition takes a
// real postal code, so the territory becomes a few circles ("within 40 miles
// of 92108") chosen to cover the team's core fans and little else. UK
// outward codes ("N17") also work in Klaviyo's zip filter, so clubs get the
// exact district list too.
import { haversineKm, POSTAL_AREAS, type Country, type PostalArea } from "../affinity/geo";
import { territory } from "../affinity/territories";
import type { TeamRef } from "./teams";

/** Areas where at least this share of the league's fans follow the team:
 *  most of them ("core"), or a big minority in a shared market ("wide"). */
export const REACH = { core: 0.5, wide: 0.3 } as const;
export type Reach = keyof typeof REACH;
const MAX_CIRCLES = 3;
const KM_PER_MILE = 1.609344;
const RADII: Record<"pro" | "soccer", number[]> = {
  pro: [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300],
  soccer: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50],
};
/** Klaviyo takes up to 500 zip codes in one condition. */
export const KLAVIYO_ZIP_LIMIT = 500;

const COUNTRY_NAME: Record<Country, string> = { US: "United States", CA: "Canada", GB: "United Kingdom" };

export interface Circle {
  /** A real postal code at the circle's center, for Klaviyo. */
  postal_code: string;
  country: Country;
  radius_miles: number;
  /** "around 921" (the postal area at the center). */
  center_area: string;
}

export interface TeamAudience {
  segment_name: string;
  circles: Circle[];
  /** "core": areas where most fans follow the team. "wide": also shared
   *  markets where a big minority do. */
  reach: Reach;
  /** Share of the team's core fans (people, weighted by share) the circles reach. */
  coverage: number;
  /** Share of people inside the circles who follow this team. */
  precision: number;
  /** Whether the team's own city is in the audience. The Chargers' core is
   *  San Diego, where "LA" would be the wrong thing to say. */
  includes_home: boolean;
  core: { areas: number; population: number };
  /** UK clubs: the core districts, for Klaviyo's zip filter. */
  outward_codes?: string[];
  /** From the brand's uploaded customer counts, when there are any. */
  customers?: { in_circles: number; in_core_areas: number; uploaded: number };
  klaviyo_segment_steps: string[];
}

interface Scored {
  area: PostalArea;
  share: number;
  /** What including the area is worth: positive where the team's share is
   *  above the threshold, negative below it. */
  value: number;
}

const BY_KEY = new Map(POSTAL_AREAS.map((a) => [a.key, a]));

function teamAreas(t: TeamRef, threshold: number): Scored[] {
  const out: Scored[] = [];
  for (const [key, shares] of territory(t.league).byArea) {
    const area = BY_KEY.get(key);
    if (!area) continue;
    const share = shares.find((s) => s.team.id === t.team.id)?.share ?? 0;
    out.push({ area, share, value: area.population * (share - threshold) });
  }
  return out;
}

/** Up to three circles that cover the core and as few other fans as can be
 *  helped. Greedy: each circle is the center and radius that adds the most
 *  value, until another circle wouldn't add much. */
export function territoryCircles(
  t: TeamRef,
  reach: Reach = "core",
): { circles: Circle[]; coverage: number; precision: number; includesHome: boolean; core: Scored[]; inside: Set<string> } {
  const threshold = REACH[reach];
  const areas = teamAreas(t, threshold);
  const core = areas.filter((a) => a.share >= threshold);
  const coreValue = core.reduce((s, a) => s + a.area.population * a.share, 0);
  const coreGain = core.reduce((s, a) => s + a.value, 0);
  const radii = RADII[t.league === "epl" ? "soccer" : "pro"];
  const maxKm = radii[radii.length - 1] * KM_PER_MILE;

  // Centers: the core areas with the most fans.
  const centers = [...core].sort((a, b) => b.area.population * b.share - a.area.population * a.share).slice(0, 40);
  const near = centers.map((c) =>
    areas
      .map((a) => ({ a, km: haversineKm(c.area, a.area) }))
      .filter((x) => x.km <= maxKm)
      .sort((x, y) => x.km - y.km),
  );

  const inside = new Set<string>();
  const circles: Circle[] = [];
  let includesHome = false;
  for (let n = 0; n < MAX_CIRCLES; n++) {
    let best = { i: -1, miles: 0, gain: 0 };
    for (let i = 0; i < centers.length; i++) {
      let gain = 0;
      let j = 0;
      for (const miles of radii) {
        const km = miles * KM_PER_MILE;
        for (; j < near[i].length && near[i][j].km <= km; j++) {
          if (!inside.has(near[i][j].a.area.key)) gain += near[i][j].a.value;
        }
        if (gain > best.gain) best = { i, miles, gain };
      }
    }
    if (best.i < 0 || best.gain <= 0.05 * coreGain) break;
    const { i, miles } = best;
    const center = centers[i].area;
    circles.push({ postal_code: center.ref, country: center.country, radius_miles: miles, center_area: `around ${center.code}` });
    if (haversineKm(center, t.team) <= miles * KM_PER_MILE) includesHome = true;
    for (const x of near[i]) if (x.km <= miles * KM_PER_MILE) inside.add(x.a.area.key);
  }

  let fansIn = 0;
  let peopleIn = 0;
  let coreIn = 0;
  for (const a of areas) {
    if (!inside.has(a.area.key)) continue;
    fansIn += a.area.population * a.share;
    peopleIn += a.area.population;
    if (a.share >= threshold) coreIn += a.area.population * a.share;
  }
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    circles,
    coverage: coreValue ? round(coreIn / coreValue) : 0,
    precision: peopleIn ? round(fansIn / peopleIn) : 0,
    includesHome,
    core,
    inside,
  };
}

export const segmentName = (t: TeamRef, reach: Reach = "core") =>
  `Walkoff · ${t.team.name} fans${reach === "wide" ? " (wide)" : ""}`;

/** The audience for a team, with how many of the brand's customers it
 *  reaches when the brand's counts are given ("US:921" -> customers). */
export function teamAudience(t: TeamRef, opts: { reach?: Reach; customersByArea?: Map<string, number> } = {}): TeamAudience {
  const reach = opts.reach ?? "core";
  const customersByArea = opts.customersByArea;
  const { circles, coverage, precision, includesHome, core, inside } = territoryCircles(t, reach);
  const name = segmentName(t, reach);
  const outward = t.league === "epl" ? core.map((a) => a.area.code).sort() : undefined;

  const steps = [`In Klaviyo, open Lists & segments, then Create → Segment, and name it "${name}".`];
  circles.forEach((c, i) => {
    steps.push(
      `${i === 0 ? "Add" : "Click OR and add"} the condition "Someone's proximity to a location": is within ${c.radius_miles} miles of ${c.postal_code} (${COUNTRY_NAME[c.country]}).`,
    );
  });
  if (outward?.length) {
    steps.push(
      `More exact for UK clubs: instead of the circles, use "Properties about someone" → Zip Code → includes any of, and paste the ${outward.length} outward codes in outward_codes${outward.length > KLAVIYO_ZIP_LIMIT ? ` (Klaviyo takes ${KLAVIYO_ZIP_LIMIT} per condition, so split them across OR conditions)` : ""}.`,
    );
  }
  steps.push("Save it once. Klaviyo keeps it up to date, so every future moment for this team can reuse it.");

  const audience: TeamAudience = {
    segment_name: name,
    reach,
    circles,
    coverage,
    precision,
    includes_home: includesHome,
    core: { areas: core.length, population: Math.round(core.reduce((s, a) => s + a.area.population, 0)) },
    ...(outward ? { outward_codes: outward } : {}),
    klaviyo_segment_steps: steps,
  };
  if (customersByArea?.size) {
    let inCircles = 0;
    let inCore = 0;
    let uploaded = 0;
    const coreKeys = new Set(core.map((a) => a.area.key));
    for (const [key, n] of customersByArea) {
      uploaded += n;
      if (inside.has(key)) inCircles += n;
      if (coreKeys.has(key)) inCore += n;
    }
    audience.customers = { in_circles: Math.round(inCircles), in_core_areas: Math.round(inCore), uploaded: Math.round(uploaded) };
  }
  return audience;
}
