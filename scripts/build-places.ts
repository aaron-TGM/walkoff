// Builds the town data behind hometown moments (lib/places):
//   data/geo/zip5.json       every US ZIP with people in it: its center and
//                            population, for counting the people in a circle
//   data/geo/places-us.json  US towns: Census places (cities, towns, villages
//                            and unincorporated communities), the towns and
//                            townships of the 12 states where those are the
//                            local government, and the postal names Census
//                            doesn't use (Capistrano Beach)
//   data/geo/places-ca.json  Canadian places of 500 people or more (GeoNames)
//   data/geo/places-gb.json  UK places of 500 people or more (GeoNames)
// Each place carries the postal code nearest its center, the center of
// Klaviyo's "within N miles of" condition. Rows are tab-separated text in
// one JSON string, which loads faster than arrays. See data/geo/README.md.
// Run: npx tsx scripts/build-places.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { haversineKm } from "../lib/affinity/geo";
import { nameKey } from "../lib/places/names";
import { cached, columns, eachRow, SOURCES, STATE_FIPS } from "./lib/sources";
import { usZctas } from "./lib/zcta";

interface Point {
  code: string;
  lat: number;
  lng: number;
}

/** Nearest point, on a grid of tenth-of-a-degree cells. */
class Grid {
  private cells = new Map<string, Point[]>();
  private all: Point[];

  constructor(points: Iterable<Point>) {
    this.all = [...points];
    for (const p of this.all) {
      const k = `${Math.floor(p.lat * 10)},${Math.floor(p.lng * 10)}`;
      const cell = this.cells.get(k);
      if (cell) cell.push(p);
      else this.cells.set(k, [p]);
    }
  }

  nearest(lat: number, lng: number): Point | undefined {
    const ci = Math.floor(lat * 10);
    const cj = Math.floor(lng * 10);
    const cos = Math.cos((lat * Math.PI) / 180);
    let best: Point | undefined;
    let bestD = Infinity;
    const visit = (p: Point) => {
      const d = (p.lat - lat) ** 2 + ((p.lng - lng) * cos) ** 2;
      if (d < bestD || (d === bestD && p.code < best!.code)) {
        best = p;
        bestD = d;
      }
    };
    for (let r = 0; r <= 30; r++) {
      // Everything in ring r is at least r - 1 cells away.
      if (best && (r - 1) * 0.1 * cos > Math.sqrt(bestD)) return best;
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) === r) this.cells.get(`${i},${j}`)?.forEach(visit);
        }
      }
    }
    // Far from everything (the Aleutians): look at every point.
    best = undefined;
    bestD = Infinity;
    this.all.forEach(visit);
    return best;
  }
}

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

// ── United States ──────────────────────────────────────────────────

/** Where towns and townships are the local government, and people say
 *  they're from them: Cherry Hill, New Jersey; Brooklyn, New York. */
const TOWN_STATES = new Set(["CT", "MA", "ME", "NH", "NJ", "NY", "PA", "RI", "VT", "MI", "MN", "WI"]);

const PLACE_SUFFIX =
  / (city and borough|metropolitan government|metro government|consolidated government|unified government|urban county|metro township|municipality|zona urbana|comunidad|corporation|borough|village|city|town|CDP)$/;
const COUSUB_SUFFIX = / (charter township|township|town|city|borough|village|plantation|grant|purchase|gore|location|municipality)$/;

/** City-counties that go by the city's name: "Nashville-Davidson
 *  metropolitan government (balance)" is Nashville. */
const CONSOLIDATED = new Set(["00", "CG", "MG", "UC", "UG"]);

/** Names people use that Census doesn't, first. */
const US_COMMON: Record<string, string> = { "Urban Honolulu": "Honolulu", "Boise City": "Boise" };

/** A Census place's names, the one people use first. "San Buenaventura
 *  (Ventura) city" is Ventura, legally San Buenaventura. */
function placeNames(raw: string, lsad: string): string[] {
  const name = raw.trim().replace(/ \(balance\)$/, "").replace(PLACE_SUFFIX, "");
  const alt = name.match(/^(.+) \((.+)\)$/);
  if (alt) return [alt[2], alt[1]];
  if (CONSOLIDATED.has(lsad) && /[-/,]/.test(name)) return [name.split(/[-/,]/)[0].trim(), name];
  return US_COMMON[name] ? [US_COMMON[name], name] : [name];
}

/** A county subdivision's name, or null for one nobody lives in by name
 *  (unorganized territory, "Township 157-30"). */
function cousubName(raw: string): string | null {
  const name = raw.trim();
  if (/ (UT|CCD|census subarea)$|not defined|\d/.test(name)) return null;
  return name.replace(COUSUB_SUFFIX, "");
}

type UsRow = [key: string, names: string, region: string, lat: number, lng: number, ref: string, land: number, rank: number];

/** 1 for the place a name shared within a state means: a city, town or
 *  village with its own government, a city-county ("Louisville/Jefferson
 *  County metro government (balance)" over the old "Louisville city"), or a
 *  Puerto Rico zona urbana. 0 for unincorporated communities. */
function placeRank(lsad: string, funcstat: string): number {
  return CONSOLIDATED.has(lsad) || lsad === "62" || ["A", "B", "C"].includes(funcstat) ? 1 : 0;
}

async function unitedStates() {
  const { centroid, land, parts } = await usZctas();
  const people = new Map<string, number>();
  for (const p of parts) {
    if (centroid.has(p.zcta) && p.state) people.set(p.zcta, (people.get(p.zcta) ?? 0) + p.population);
  }
  const states = new Set(Object.values(STATE_FIPS));
  // Each ZIP's postal name: what people there write as their town.
  const postalRows: { zip: string; name: string; state: string; county: string; lat: number; lng: number }[] = [];
  eachRow(await cached(SOURCES.geonamesUS), "\t", (cells) => {
    const [, zip, name, , state, , county] = cells;
    const lat = Number(cells[9]);
    const lng = Number(cells[10]);
    if (name && states.has(state) && Number.isFinite(lat) && Number.isFinite(lng)) postalRows.push({ zip, name, state, county, lat, lng });
  });
  const postalName = new Map(postalRows.map((r) => [r.zip, r]));
  const zips = [...people.entries()]
    .filter(([, n]) => Math.round(n) > 0)
    .map(([zip, n]) => ({
      code: zip,
      lat: centroid.get(zip)![0],
      lng: centroid.get(zip)![1],
      population: Math.round(n),
      name: postalName.get(zip)?.name ?? "",
      state: postalName.get(zip)?.state ?? "",
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const populated = new Map(zips.map((z) => [z.code, z]));
  const grid = new Grid(zips);
  const zipAt = (lat: number, lng: number) => grid.nearest(lat, lng) as (typeof zips)[number];
  const nearestZip = (lat: number, lng: number) => zipAt(lat, lng).code;

  // GeoNames' point for each town, by state and name: the biggest when a
  // name repeats.
  const geonames = new Map<string, { lat: number; lng: number; population: number }>();
  eachRow(await cached(SOURCES.geonamesCities), "\t", (cells) => {
    if (cells[8] !== "US" || cells[6] !== "P") return;
    const k = `${cells[10]}|${nameKey(cells[1])}`;
    const population = Number(cells[14]) || 0;
    if ((geonames.get(k)?.population ?? -1) < population) geonames.set(k, { lat: Number(cells[4]), lng: Number(cells[5]), population });
  });
  /** Census puts a few places with wide waters out on the water: San
   *  Francisco's point is by the Farallon Islands, 30 miles from its people.
   *  For those, GeoNames' point, when the ZIP nearest it carries the
   *  place's name and the ZIP nearest Census's doesn't. */
  const onLand = (names: string[], state: string, lat: number, lng: number) => {
    const keys = new Set(names.map(nameKey));
    if (keys.has(nameKey(zipAt(lat, lng).name))) return null;
    const g = names.map((n) => geonames.get(`${state}|${nameKey(n)}`)).find((x) => x !== undefined);
    if (!g || haversineKm({ lat, lng }, g) / 1.609344 > 40 || !keys.has(nameKey(zipAt(g.lat, g.lng).name))) return null;
    return g;
  };
  let moved = 0;

  const rows: UsRow[] = [];
  /** Name keys already used in each state. */
  const used = new Map<string, Set<string>>();
  const use = (state: string, names: string[]) => {
    const set = used.get(state) ?? new Set<string>();
    for (const n of names) set.add(nameKey(n));
    used.set(state, set);
  };
  const isUsed = (state: string, name: string) => used.get(state)?.has(nameKey(name)) ?? false;

  // Census places: incorporated places and unincorporated communities.
  let col: (n: string) => number = () => 0;
  eachRow(await cached(SOURCES.placeGazetteer), "\t", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    const state = cells[col("USPS")];
    if (!states.has(state)) return;
    const names = placeNames(cells[col("NAME")], cells[col("LSAD")]);
    let lat = Number(cells[col("INTPTLAT")]);
    let lng = Number(cells[col("INTPTLONG")]);
    if (Number(cells[col("AWATER_SQMI")]) > Number(cells[col("ALAND_SQMI")])) {
      const land = onLand(names, state, lat, lng);
      if (land) {
        ({ lat, lng } = land);
        moved++;
      }
    }
    const rank = placeRank(cells[col("LSAD")], cells[col("FUNCSTAT")]);
    rows.push([`census:${cells[col("GEOID")]}`, names.join("|"), state, round(lat, 4), round(lng, 4), nearestZip(lat, lng), round(Number(cells[col("ALAND_SQMI")]), 2), rank]);
    use(state, names);
  });
  const places = rows.length;

  // Towns and townships, where no place has the name.
  const cousubs: { state: string; row: UsRow; name: string }[] = [];
  eachRow(await cached(SOURCES.countySubdivisionGazetteer), "\t", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    const state = cells[col("USPS")];
    if (!TOWN_STATES.has(state)) return;
    const name = cousubName(cells[col("NAME")]);
    const area = Number(cells[col("ALAND_SQMI")]);
    if (!name || area <= 0 || isUsed(state, name)) return;
    const lat = Number(cells[col("INTPTLAT")]);
    const lng = Number(cells[col("INTPTLONG")]);
    cousubs.push({ state, name, row: [`cousub:${cells[col("GEOID")]}`, name, state, round(lat, 4), round(lng, 4), nearestZip(lat, lng), round(area, 2), 0] });
  });
  // Added after the loop, so a township shares its name with townships in
  // other counties (and stays ambiguous) instead of hiding them.
  for (const c of cousubs) {
    rows.push(c.row);
    use(c.state, [c.name]);
  }

  // Postal names Census doesn't use, one place per name and county.
  const groups = new Map<string, { state: string; name: string; zips: string[] }>();
  for (const { zip, name, state, county } of postalRows) {
    if (isUsed(state, name)) continue;
    const k = `${state}|${nameKey(name)}|${county}`;
    const g = groups.get(k) ?? { state, name, zips: [] };
    g.zips.push(zip);
    groups.set(k, g);
  }
  let postal = 0;
  for (const g of groups.values()) {
    const lived = g.zips.map((z) => populated.get(z)).filter((z) => z !== undefined);
    // Only PO boxes and company ZIPs: no one lives at that name.
    if (lived.length === 0) continue;
    const people = lived.reduce((s, z) => s + z.population, 0);
    const lat = lived.reduce((s, z) => s + z.lat * z.population, 0) / people;
    const lng = lived.reduce((s, z) => s + z.lng * z.population, 0) / people;
    const ref = new Grid(lived).nearest(lat, lng)!.code;
    const area = g.zips.reduce((s, z) => s + (land.get(z) ?? 0), 0);
    const first = [...g.zips].sort()[0];
    rows.push([`zip:${first}`, g.name, g.state, round(lat, 4), round(lng, 4), ref, round(area, 2), 0]);
    postal++;
  }
  // A legal name in parentheses gives way to a place that goes by it:
  // "Centerville (Thurman) village" is Thurman, and "Centerville, Ohio"
  // means the city of Centerville.
  const primary = new Set(rows.map((r) => `${r[2]}|${nameKey(r[1].split("|")[0])}`));
  for (const r of rows) {
    const [first, ...rest] = r[1].split("|");
    r[1] = [first, ...rest.filter((n) => !primary.has(`${r[2]}|${nameKey(n)}`))].join("|");
  }
  console.log(`US ${zips.length} ZIPs; ${places} Census places (${moved} moved onto land), ${cousubs.length} towns and townships, ${postal} postal names`);
  return { zips, rows: rows.sort((a, b) => a[0].localeCompare(b[0])) };
}

// ── Canada and the UK ──────────────────────────────────────────────

/** GeoNames' numbered provinces. */
const CA_ADMIN1: Record<string, string> = {
  "01": "AB", "02": "BC", "03": "MB", "04": "NB", "05": "NL", "07": "NS", "08": "ON",
  "09": "PE", "10": "QC", "11": "SK", "12": "YT", "13": "NT", "14": "NU",
};

/** Names people use for a place GeoNames names in full, after its own. */
const OTHER_NAMES: Record<string, string[]> = {
  "GB:Derry": ["Londonderry"],
  "GB:Kingston upon Hull": ["Hull"],
  "GB:Newcastle upon Tyne": ["Newcastle"],
  "GB:Stoke-on-Trent": ["Stoke"],
  "GB:Southend-on-Sea": ["Southend"],
};

/** Populated places that no longer are. */
const GONE = new Set(["PPLH", "PPLQ", "PPLW", "PPLCH"]);

type OtherRow = [key: string, names: string, region: string, lat: number, lng: number, ref: string, population: number, section: number];

async function postcodes(source: string, format: (raw: string) => string | null): Promise<Grid> {
  const points: Point[] = [];
  eachRow(await cached(source), "\t", (cells) => {
    const code = format(cells[1] ?? "");
    const lat = Number(cells[9]);
    const lng = Number(cells[10]);
    if (code && Number.isFinite(lat) && Number.isFinite(lng)) points.push({ code, lat, lng });
  });
  return new Grid(points);
}

async function canadaAndBritain() {
  const grids = {
    CA: await postcodes(SOURCES.geonamesCA, (raw) => {
      const c = raw.toUpperCase().replace(/\s+/g, "");
      return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(c) ? `${c.slice(0, 3)} ${c.slice(3)}` : null;
    }),
    GB: await postcodes(SOURCES.geonamesGB, (raw) => {
      const c = raw.trim().toUpperCase().replace(/\s+/g, " ");
      return c.includes(" ") ? c : null;
    }),
  };
  const out: Record<"CA" | "GB", OtherRow[]> = { CA: [], GB: [] };
  eachRow(await cached(SOURCES.geonamesCities), "\t", (cells) => {
    const country = cells[8];
    if ((country !== "CA" && country !== "GB") || cells[6] !== "P" || GONE.has(cells[7])) return;
    const region = country === "CA" ? CA_ADMIN1[cells[10]] : cells[10];
    if (!region) return;
    const [id, name, ascii] = cells;
    const lat = Number(cells[4]);
    const lng = Number(cells[5]);
    const names = [name, ...(nameKey(ascii) !== nameKey(name) ? [ascii] : []), ...(OTHER_NAMES[`${country}:${name}`] ?? [])];
    const ref = grids[country].nearest(lat, lng)?.code;
    if (!ref) return;
    // A section is part of a bigger city (Richmond Heights in Saskatoon):
    // found by name, never as the town at a point.
    const section = cells[7] === "PPLX" ? 1 : 0;
    out[country].push([`geonames:${id}`, names.join("|"), region, round(lat, 4), round(lng, 4), ref, Number(cells[14]) || 0, section]);
  });
  for (const rows of Object.values(out)) rows.sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`CA ${out.CA.length} places, GB ${out.GB.length} places`);
  return out;
}

// ── Output ─────────────────────────────────────────────────────────

const CENSUS =
  "U.S. Census Bureau: 2023 Gazetteer Files (ZCTAs, places, county subdivisions), 2010 ZCTA to County Relationship File and Vintage 2025 county population estimates (public domain).";
const GEONAMES = "GeoNames (geonames.org) postal codes and populated places, CC BY 4.0.";

function write(file: string, attribution: string[], fields: string[], rows: (string | number)[][]) {
  const path = `data/geo/${file}`;
  const text = JSON.stringify({ attribution, fields, rows: rows.map((r) => r.join("\t")).join("\n") });
  writeFileSync(path, text);
  console.log(`${path}: ${rows.length} rows, ${(text.length / 1e6).toFixed(2)} MB`);
}

async function main() {
  const us = await unitedStates();
  const other = await canadaAndBritain();
  mkdirSync("data/geo", { recursive: true });
  write("zip5.json", [CENSUS, GEONAMES], ["zip", "lat", "lng", "population", "name", "region"], us.zips.map((z) => [z.code, round(z.lat, 4), round(z.lng, 4), z.population, z.name, z.state]));
  write("places-us.json", [CENSUS, GEONAMES], ["key", "names", "region", "lat", "lng", "ref", "land", "rank"], us.rows);
  for (const country of ["CA", "GB"] as const) {
    write(`places-${country.toLowerCase()}.json`, [GEONAMES], ["key", "names", "region", "lat", "lng", "ref", "population", "section"], other[country]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
