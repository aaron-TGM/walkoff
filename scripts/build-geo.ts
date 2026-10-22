// Builds data/geo/postal-areas.json: a centroid and population for every
// postal area the affinity map uses.
//   US: 3-digit ZIP prefix  (Census 2023 ZCTA centroids, 2010 ZCTA population
//       moved forward with 2025 county estimates)
//   CA: forward sortation area, the first 3 characters (GeoNames)
//   GB: postcode district, the part before the space (GeoNames; ONS 2021
//       headcounts for England and Wales)
// Run: npx tsx scripts/build-geo.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { cached, columns, eachRow, SOURCES, STATE_FIPS } from "./lib/sources";

type Row = [code: string, lat: number, lng: number, population: number, region: string];

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

function finish(map: Map<string, Acc>): Row[] {
  return [...map.entries()]
    .filter(([, a]) => a.weight > 0 && a.population > 0)
    .map(([code, a]): Row => [
      code,
      Math.round((a.lat / a.weight) * 1000) / 1000,
      Math.round((a.lng / a.weight) * 1000) / 1000,
      Math.round(a.population),
      [...a.regions.entries()].sort((x, y) => y[1] - x[1])[0][0],
    ])
    .sort((x, y) => x[0].localeCompare(y[0]));
}

async function unitedStates(): Promise<Row[]> {
  // ZCTA centroids.
  const centroid = new Map<string, [number, number]>();
  let col: (n: string) => number = () => 0;
  eachRow(await cached(SOURCES.zctaGazetteer), "\t", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    centroid.set(cells[col("GEOID")], [Number(cells[col("INTPTLAT")]), Number(cells[col("INTPTLONG")])]);
  });

  // 2010 population of each ZCTA, split by county.
  const parts: { zcta: string; county: string; state: string; pop: number }[] = [];
  const county2010 = new Map<string, number>();
  const state2010 = new Map<string, number>();
  eachRow(await cached(SOURCES.zctaCounty2010), ",", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    const pop = Number(cells[col("POPPT")]);
    const county = cells[col("GEOID")];
    const state = cells[col("STATE")];
    parts.push({ zcta: cells[col("ZCTA5")], county, state, pop });
    county2010.set(county, (county2010.get(county) ?? 0) + pop);
    state2010.set(state, (state2010.get(state) ?? 0) + pop);
  });

  // Growth since 2010 from the latest county estimates. Connecticut replaced
  // its counties in 2022, so it falls back to statewide growth.
  const county2025 = new Map<string, number>();
  const state2025 = new Map<string, number>();
  eachRow(await cached(SOURCES.countyEstimates), ",", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    const pop = Number(cells[col("POPESTIMATE2025")]);
    const state = cells[col("STATE")];
    if (cells[col("SUMLEV")] === "040") state2025.set(state, pop);
    else county2025.set(state + cells[col("COUNTY")], pop);
  });
  const growth = (county: string, state: string): number => {
    const now = county2025.get(county);
    const then = county2010.get(county);
    if (now && then) return now / then;
    const sNow = state2025.get(state);
    const sThen = state2010.get(state);
    return sNow && sThen ? sNow / sThen : 1;
  };

  const zip3 = new Map<string, Acc>();
  for (const p of parts) {
    const c = centroid.get(p.zcta);
    const state = STATE_FIPS[p.state];
    if (!c || !state) continue;
    const pop = p.pop * growth(p.county, p.state);
    add(zip3, p.zcta.slice(0, 3), c[0], c[1], pop, pop, state);
  }
  return finish(zip3);
}

async function canada(): Promise<Row[]> {
  // No population by FSA we can download here, so postal-code counts stand
  // in for population, scaled to the 2021 Census total.
  const fsa = new Map<string, Acc>();
  let codes = 0;
  eachRow(await cached(SOURCES.geonamesCA), "\t", (cells) => {
    const code = cells[1]?.toUpperCase().replace(/\s+/g, "");
    const lat = Number(cells[9]);
    const lng = Number(cells[10]);
    if (!code || code.length < 3 || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    add(fsa, code.slice(0, 3), lat, lng, 1, 1, cells[4] || "");
    codes++;
  });
  const perCode = 36_991_981 / codes;
  for (const a of fsa.values()) a.population *= perCode;
  return finish(fsa);
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
  eachRow(await cached(SOURCES.geonamesGB), "\t", (cells) => {
    const district = cells[1]?.trim().split(/\s+/)[0]?.toUpperCase();
    const lat = Number(cells[9]);
    const lng = Number(cells[10]);
    if (!district || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
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
  return finish(districts);
}

async function main() {
  const [US, CA, GB] = [await unitedStates(), await canada(), await greatBritain()];
  const out = {
    attribution: [
      "US: U.S. Census Bureau, 2023 Gazetteer ZCTA file, 2010 ZCTA to County Relationship File and Vintage 2025 county population estimates (public domain).",
      "Canada and Great Britain postal codes: GeoNames (geonames.org), CC BY 4.0.",
      "England and Wales population: Office for National Statistics, Census 2021 postcode headcounts, Open Government Licence v3.0.",
    ],
    fields: ["code", "lat", "lng", "population", "region"],
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
