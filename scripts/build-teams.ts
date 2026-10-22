// Builds data/geo/team-homes.json: where every V1 team plays and the shape
// of its fan base, for the territory model in lib/affinity.
// Needs data/geo/postal-areas.json (scripts/build-geo.ts) first.
// Run: npx tsx scripts/build-teams.ts
import { readFileSync, writeFileSync } from "node:fs";
import { LEAGUES } from "../lib/leagues";
import { cached, columns, eachRow, SOURCES, STATE_ABBR } from "./lib/sources";
import {
  COLLEGE_HOMES,
  COLLEGE_OVERRIDES,
  COLLEGE_WEIGHT,
  EPL_GROUNDS,
  FAN_BASES,
  HOME_OVERRIDES,
  POWER_CONFERENCE_MEMBERS,
  type FanBase,
} from "./lib/team-overrides";

const B = "https://site.api.espn.com/apis/site/v2/sports";

interface TeamHome {
  id: string;
  abbr: string;
  name: string;
  /** "Philadelphia" / "Eagles"; "Michigan" / "Wolverines". */
  location: string;
  nickname: string;
  country: "US" | "CA" | "GB";
  region: string;
  lat: number;
  lng: number;
  weight: number;
  reach: number;
  regions: string[];
}

interface Venue {
  city?: string;
  state?: string;
  zipCode?: string;
}

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ── Geocoding ──────────────────────────────────────────────────────

const areas = JSON.parse(readFileSync("data/geo/postal-areas.json", "utf8")) as {
  areas: Record<string, [string, number, number, number, string][]>;
};
const areaIndex = (country: string) => new Map(areas.areas[country].map((r) => [r[0], r]));
const US_AREAS = areaIndex("US");
const CA_AREAS = areaIndex("CA");
const GB_AREAS = areaIndex("GB");

const zcta = new Map<string, [number, number]>();
const places = new Map<string, { base: string; lat: number; lng: number; land: number }[]>();

function placeBase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(balance\)/g, "")
    .replace(
      /\b(city|town|village|borough|cdp|municipality|metropolitan government|metro government|unified government|consolidated government|urban county|city and borough)\b/g,
      "",
    )
    .replace(/^saint /, "st. ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadGazetteers(): Promise<void> {
  let col: (n: string) => number = () => 0;
  eachRow(await cached(SOURCES.zctaGazetteer), "\t", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    zcta.set(cells[col("GEOID")], [Number(cells[col("INTPTLAT")]), Number(cells[col("INTPTLONG")])]);
  });
  // Places, then county subdivisions: New England towns and Pennsylvania
  // townships (Hamden, CT; Moon Township, PA) aren't Census places.
  for (const source of [SOURCES.placeGazetteer, SOURCES.countySubdivisionGazetteer]) {
    eachRow(await cached(source), "\t", (cells, i) => {
      if (i === 0) return void (col = columns(cells));
      const state = cells[col("USPS")];
      const list = places.get(state) ?? [];
      list.push({
        base: placeBase(cells[col("NAME")]),
        lat: Number(cells[col("INTPTLAT")]),
        lng: Number(cells[col("INTPTLONG")]),
        land: Number(cells[col("ALAND")]),
      });
      places.set(state, list);
    });
  }
}

/** Neighborhoods and boroughs the gazetteers file under their city. */
const CITY_ALIASES: Record<string, string> = {
  "bronx, NY": "New York",
  "brooklyn, NY": "New York",
  "queens, NY": "New York",
  "staten island, NY": "New York",
  "riverdale, NY": "New York",
  "northridge, CA": "Los Angeles",
};

function placeCoords(city: string, state: string): [number, number] | null {
  const want = placeBase(CITY_ALIASES[`${city.toLowerCase()}, ${state}`] ?? city);
  const list = places.get(state) ?? [];
  const exact = list.filter((p) => p.base === want);
  // "Nashville" is "Nashville-Davidson metropolitan government (balance)";
  // "Moon Township" is "Moon township".
  const near = exact.length
    ? exact
    : list.filter(
        (p) =>
          p.base.startsWith(`${want}-`) ||
          p.base.startsWith(`${want}/`) ||
          p.base === want.replace(/ township$/, ""),
      );
  const best = near.sort((a, b) => b.land - a.land)[0];
  return best ? [best.lat, best.lng] : null;
}

/** "CA:M5V", "19148" or "Philadelphia, PA" to a location. */
function resolve(spec: string): Pick<TeamHome, "country" | "region" | "lat" | "lng"> | null {
  if (spec.startsWith("CA:")) {
    const a = CA_AREAS.get(spec.slice(3));
    return a ? { country: "CA", region: a[4], lat: a[1], lng: a[2] } : null;
  }
  if (/^\d{5}$/.test(spec)) {
    const c = zcta.get(spec);
    const state = US_AREAS.get(spec.slice(0, 3))?.[4];
    return c && state ? { country: "US", region: state, lat: c[0], lng: c[1] } : null;
  }
  const m = spec.match(/^(.+),\s*([A-Z]{2})$/);
  if (m) {
    const c = placeCoords(m[1], m[2]);
    return c ? { country: "US", region: m[2], lat: c[0], lng: c[1] } : null;
  }
  return null;
}

/** Ways to place a venue, best first: its ZIP, then its city. Arenas often
 *  use PO-box ZIPs that have no map area, so the city is the fallback. */
function venueSpecs(v: Venue | undefined): string[] {
  const specs: string[] = [];
  if (v?.zipCode && /^\d{5}/.test(v.zipCode)) specs.push(v.zipCode.slice(0, 5));
  const state = v?.state && (/^[A-Z]{2}$/.test(v.state) ? v.state : STATE_ABBR[v.state.toLowerCase()]);
  if (v?.city && state) specs.push(`${v.city}, ${state}`);
  return specs;
}

function resolveFirst(specs: string[]): ReturnType<typeof resolve> {
  for (const spec of specs) {
    const where = resolve(spec);
    if (where) return where;
  }
  return null;
}

function finish(
  base: { id: string; abbr: string; name: string; location: string; nickname: string },
  where: Pick<TeamHome, "country" | "region" | "lat" | "lng">,
  fan: FanBase,
): TeamHome {
  return {
    ...base,
    ...where,
    lat: Math.round(where.lat * 1000) / 1000,
    lng: Math.round(where.lng * 1000) / 1000,
    weight: fan.weight ?? 1,
    reach: fan.reach ?? 1,
    regions: fan.regions ?? [],
  };
}

// ── Leagues ────────────────────────────────────────────────────────

interface EspnTeamRef {
  team: { id: string; abbreviation: string; displayName: string; location?: string; name?: string };
}

async function teamList(feedPath: string) {
  const d = await getJson<{ sports: { leagues: { teams: EspnTeamRef[] }[] }[] }>(
    `${B}/${feedPath}/teams?limit=1000`,
  );
  return d.sports[0].leagues[0].teams.map((t) => ({
    id: t.team.id,
    abbr: t.team.abbreviation,
    name: t.team.displayName,
    location: t.team.location ?? "",
    nickname: t.team.name ?? "",
  }));
}

async function proLeague(league: string, feedPath: string): Promise<TeamHome[]> {
  const teams = await teamList(feedPath);
  return pool(teams, 8, async (t) => {
    const override = HOME_OVERRIDES[league]?.[t.abbr];
    let specs = override ? [override] : [];
    if (!override) {
      const d = await getJson<{ team: { franchise?: { venue?: { address?: Venue } } } }>(
        `${B}/${feedPath}/teams/${t.id}`,
      );
      specs = venueSpecs(d.team.franchise?.venue?.address);
    }
    const where = resolveFirst(specs);
    if (!where) {
      throw new Error(`${league} ${t.abbr}: can't place ${JSON.stringify(specs)}. Add a HOME_OVERRIDES entry.`);
    }
    return finish(t, where, FAN_BASES[league]?.[t.abbr] ?? {});
  });
}

async function premierLeague(feedPath: string): Promise<TeamHome[]> {
  const teams = await teamList(feedPath);
  return teams.map((t) => {
    const district = EPL_GROUNDS[t.abbr];
    const a = district ? GB_AREAS.get(district) : undefined;
    if (!a) throw new Error(`epl ${t.abbr}: add its ground to EPL_GROUNDS`);
    return finish(t, { country: "GB", region: a[4], lat: a[1], lng: a[2] }, FAN_BASES.epl?.[t.abbr] ?? {});
  });
}

interface CollegeTeam {
  id: string;
  abbr: string;
  name: string;
  location: string;
  nickname: string;
  conference: string | null;
}

async function collegeTeams(feedPath: string): Promise<CollegeTeam[]> {
  const teams = await teamList(feedPath);
  return pool(teams, 10, async (t) => {
    const d = await getJson<{ team: { groups?: { id?: string } } }>(`${B}/${feedPath}/teams/${t.id}`);
    return { ...t, conference: d.team.groups?.id ?? null };
  });
}

interface ScheduleEvent {
  competitions?: {
    neutralSite?: boolean;
    venue?: { address?: Venue };
    competitors?: { homeAway?: string; team?: { id?: string } }[];
  }[];
}

/** The venue a team uses most for home games in a season's schedule, as
 *  its ways to place it (see venueSpecs). */
async function homeVenue(feedPath: string, teamId: string, season?: number): Promise<string[]> {
  const qs = season ? `?season=${season}` : "";
  const d = await getJson<{ events?: ScheduleEvent[] }>(`${B}/${feedPath}/teams/${teamId}/schedule${qs}`);
  const counts = new Map<string, { specs: string[]; n: number }>();
  for (const ev of d.events ?? []) {
    const c = ev.competitions?.[0];
    const home = c?.competitors?.find((x) => x.homeAway === "home")?.team?.id === teamId;
    if (!home || c?.neutralSite) continue;
    const specs = venueSpecs(c?.venue?.address);
    if (!specs.length) continue;
    const key = specs.join("|");
    counts.set(key, { specs, n: (counts.get(key)?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.specs ?? [];
}

/** FBS teams: everyone with at least four games on this season's FBS
 *  scoreboards. The feed's team groups miss whole conferences (the AAC). */
async function fbsTeamIds(feedPath: string): Promise<Set<string>> {
  const games = new Map<string, number>();
  for (let week = 1; week <= 15; week++) {
    const d = await getJson<{ events?: ScheduleEvent[] }>(
      `${B}/${feedPath}/scoreboard?groups=80&limit=300&seasontype=2&week=${week}`,
    ).catch(() => ({ events: [] }));
    for (const ev of d.events ?? []) {
      for (const c of ev.competitions?.[0]?.competitors ?? []) {
        const id = c.team?.id;
        if (id) games.set(id, (games.get(id) ?? 0) + 1);
      }
    }
  }
  return new Set([...games].filter(([, n]) => n >= 4).map(([id]) => id));
}

async function college(
  league: "ncaaf" | "ncaab",
  feedPath: string,
  memberIds: Set<string> | null,
  season: number | undefined,
  fallback: Map<string, TeamHome>,
): Promise<TeamHome[]> {
  const all = await collegeTeams(feedPath);
  const members = memberIds ? all.filter((t) => memberIds.has(t.id)) : all;
  const powerIds = new Set(
    POWER_CONFERENCE_MEMBERS[league].map((name) => {
      const t = members.find((m) => m.name === name);
      if (!t?.conference) throw new Error(`${league}: can't find conference for ${name}`);
      return t.conference;
    }),
  );
  const out = await pool(members, 8, async (t) => {
    const fixed = COLLEGE_HOMES[league]?.[t.name];
    const specs = fixed ? [fixed] : await homeVenue(feedPath, t.id, season).catch(() => [] as string[]);
    let where = resolveFirst(specs);
    const known = fallback.get(t.id);
    if (!where && known) where = { country: known.country, region: known.region, lat: known.lat, lng: known.lng };
    if (!where) {
      console.warn(`  ${league}: no home venue for ${t.name} (${specs.join(" / ") || "none"}), skipped`);
      return null;
    }
    const fan: FanBase = {
      ...(powerIds.has(t.conference ?? "") ? COLLEGE_WEIGHT.power : COLLEGE_WEIGHT.other),
      ...COLLEGE_OVERRIDES[league]?.[t.name],
    };
    return finish(t, where, fan);
  });
  return out.filter((t): t is TeamHome => t !== null);
}

async function main() {
  await loadGazetteers();
  const path = (id: string) => LEAGUES.find((l) => l.id === id)!.feedPath;
  const out: Record<string, TeamHome[]> = {};
  for (const id of ["nfl", "nba", "nhl", "mlb"]) {
    out[id] = await proLeague(id, path(id));
    console.log(`${id}: ${out[id].length} teams`);
  }
  out.epl = await premierLeague(path("epl"));
  console.log(`epl: ${out.epl.length} teams`);
  // Football schedules carry ZIP codes.
  out.ncaaf = await college("ncaaf", path("ncaaf"), await fbsTeamIds(path("ncaaf")), undefined, new Map());
  console.log(`ncaaf: ${out.ncaaf.length} FBS teams`);
  // The basketball team list is Division I. Last season's schedule, since
  // this one hasn't started.
  out.ncaab = await college("ncaab", path("ncaab"), null, 2026, new Map(out.ncaaf.map((t) => [t.id, t])));
  console.log(`ncaab: ${out.ncaab.length} Division I teams`);

  writeFileSync(
    "data/geo/team-homes.json",
    JSON.stringify({
      note: "Team homes and fan-base shape for lib/affinity. Built by scripts/build-teams.ts.",
      leagues: out,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
