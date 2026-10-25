// Builds data/geo/postal-areas.json: a centroid and population for every
// postal area the affinity map uses, and the full postal code nearest its
// center (for Klaviyo's "within N miles of a postal code" condition).
//   US: 3-digit ZIP prefix  (Census 2023 ZCTA centroids, 2010 ZCTA population
//       moved forward with 2025 county estimates)
//   CA: forward sortation area, the first 3 characters (GeoNames)
//   GB: postcode district, the part before the space (GeoNames; ONS 2021
//       headcounts for England and Wales)
// Run: npx tsx scripts/build-geo.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { cached, eachRow, SOURCES } from "./lib/sources";
import { usZctas } from "./lib/zcta";

type Area = [code: string, lat: number, lng: number, population: number, region: string];
type Row = [...Area, ref: string];
type Visit = (area: string, code: string, lat: number, lng: number) => void;

interface Acc {
  lat: number;
  lng: number;
  weight: number;
  population: number;
  regions: Map<string, number>;
}

function add(map: Map<string, Acc>, code: string, lat: number, lng: number, weight: number, population: number, region: string) {
  let a = map.get(code);
  if (!a) {
    a = { lat: 0, lng: 0, weight: 0, population: 0, regions: new Map() };
    map.set(code, a);
  }
  a.lat += lat * weight;
  a.lng += lng * weight;
  a.weight += weight;
  a.population += population;
  a.regions.set(region, (a.regions.get(region) ?? 0) + weight);
}

function finish(map: Map<string, Acc>, points: (visit: Visit) => void): Row[] {
  const areas = [...map.entries()]
    .filter(([, a]) => a.weight > 0 && a.population > 0)
    .map(([code, a]): Area => [
      code,
      Math.round((a.lat / a.weight) * 1000) / 1000,
      Math.round((a.lng / a.weight) * 1000) / 1000,
      Math.round(a.population),
      [...a.regions.entries()].sort((x, y) => y[1] - x[1])[0][0],
    ])
    .sort((x, y) => x[0].localeCompare(y[0]));
  return withRefs(areas, points);
}

/** The full postal code nearest each area's center. */
function withRefs(areas: Area[], points: (visit: Visit) => void): Row[] {
  const byCode = new Map(areas.map((a) => [a[0], a]));
  const best = new Map<string, { code: string; d: number }>();
  points((area, code, lat, lng) => {
    const a = byCode.get(area);
    if (!a) return;
    const d = (lat - a[1]) ** 2 + ((lng - a[2]) * Math.cos((a[1] * Math.PI) / 180)) ** 2;
    const b = best.get(area);
    if (!b || d < b.d || (d === b.d && code < b.code)) best.set(area, { code, d });
  });
  return areas.map((a): Row => [...a, best.get(a[0])?.code ?? ""]);
}

async function unitedStates(): Promise<Row[]> {
  const { centroid, parts, populated } = await usZctas();
  const zip3 = new Map<string, Acc>();
  for (const p of parts) {
    const c = centroid.get(p.zcta);
    if (!c || !p.state) continue;
    add(zip3, p.zcta.slice(0, 3), c[0], c[1], p.population, p.population, p.state);
  }
  return finish(zip3, (visit) => {
    for (const [zcta, [lat, lng]] of centroid) if (populated.has(zcta)) visit(zcta.slice(0, 3), zcta, lat, lng);
  });
}

async function canada(): Promise<Row[]> {
  // No population by FSA we can download here, so postal-code counts stand
  // in for population, scaled to the 2021 Census total.
  const fsa = new Map<string, Acc>();
  let codes = 0;
  const source = await cached(SOURCES.geonamesCA);
  const each = (visit: (cells: string[], code: string, lat: number, lng: number) => void) =>
    eachRow(source, "\t", (cells) => {
      const code = cells[1]?.toUpperCase().replace(/\s+/g, "");
      const lat = Number(cells[9]);
      const lng = Number(cells[10]);
      if (!code || code.length < 3 || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      visit(cells, code, lat, lng);
    });
  each((cells, code, lat, lng) => {
    add(fsa, code.slice(0, 3), lat, lng, 1, 1, cells[4] || "");
    codes++;
  });
  const perCode = 36_991_981 / codes;
  for (const a of fsa.values()) a.population *= perCode;
  return finish(fsa, (visit) =>
    each((_, code, lat, lng) => {
      if (code.length === 6) visit(code.slice(0, 3), `${code.slice(0, 3)} ${code.slice(3)}`, lat, lng);
    }),
  );
}

async function greatBritain(): Promise<Row[]> {
  // England and Wales: 2021 Census headcounts by postcode.
  const headcount = new Map<string, number>();
  eachRow(await cached(SOURCES.onsPostcodeHeadcounts), ",", (cells, i) => {
    if (i === 0) return;
    const district = cells[0].trim().split(/\s+/)[0]?.toUpperCase();
    if (district) headcount.set(district, (headcount.get(district) ?? 0) + Number(cells[3] || 0));
  });

  const districts = new Map<string, Acc>();
  const postcodes = new Map<string, number>();
  const source = await cached(SOURCES.geonamesGB);
  const each = (visit: (cells: string[], district: string, lat: number, lng: number) => void) =>
    eachRow(source, "\t", (cells) => {
      const district = cells[1]?.trim().split(/\s+/)[0]?.toUpperCase();
      const lat = Number(cells[9]);
      const lng = Number(cells[10]);
      if (!district || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      visit(cells, district, lat, lng);
    });
  each((cells, district, lat, lng) => {
    add(districts, district, lat, lng, 1, 0, cells[4] || "");
    postcodes.set(district, (postcodes.get(district) ?? 0) + 1);
  });

  // Scotland and Northern Ireland: postcode count times the England and
  // Wales average of people per postcode.
  let people = 0;
  let codes = 0;
  for (const [d, n] of headcount) {
    if (postcodes.has(d)) {
      people += n;
      codes += postcodes.get(d)!;
    }
  }
  const perPostcode = people / codes;
  for (const [d, a] of districts) {
    a.population = headcount.get(d) ?? (postcodes.get(d) ?? 0) * perPostcode;
  }
  return finish(districts, (visit) =>
    each((cells, district, lat, lng) => {
      const postcode = cells[1].trim().toUpperCase().replace(/\s+/g, " ");
      if (postcode.includes(" ")) visit(district, postcode, lat, lng);
    }),
  );
}

async function main() {
  const [US, CA, GB] = [await unitedStates(), await canada(), await greatBritain()];
  const out = {
    attribution: [
      "US: U.S. Census Bureau, 2023 Gazetteer ZCTA file, 2010 ZCTA to County Relationship File and Vintage 2025 county population estimates (public domain).",
      "Canada and Great Britain postal codes: GeoNames (geonames.org), CC BY 4.0.",
      "England and Wales population: Office for National Statistics, Census 2021 postcode headcounts, Open Government Licence v3.0.",
    ],
    fields: ["code", "lat", "lng", "population", "region", "ref"],
    areas: { US, CA, GB },
  };
  mkdirSync("data/geo", { recursive: true });
  writeFileSync("data/geo/postal-areas.json", JSON.stringify(out));
  const total = (rows: Row[]) => rows.reduce((s, r) => s + r[3], 0);
  console.log(`US ${US.length} ZIP3s, pop ${total(US).toLocaleString()}`);
  console.log(`CA ${CA.length} FSAs, pop ${total(CA).toLocaleString()}`);
  console.log(`GB ${GB.length} districts, pop ${total(GB).toLocaleString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
