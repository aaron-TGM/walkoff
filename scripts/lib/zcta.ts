// US ZIP code tabulation areas (ZCTAs): each one's center and its people
// today, shared by build-geo.ts (3-digit areas) and build-places.ts (town
// circles), so a 3-digit area's population is the sum of its ZIPs'.
// Population is the 2010 count moved forward with each county's growth to
// the latest estimates.
import { cached, columns, eachRow, SOURCES, STATE_FIPS } from "./sources";

export interface ZctaPart {
  zcta: string;
  /** "CA". Undefined for a state code the build doesn't know. */
  state: string | undefined;
  /** People in the part of the ZCTA that's in one county, today. */
  population: number;
}

export interface Zctas {
  /** Each ZCTA's internal point: [lat, lng]. */
  centroid: Map<string, [number, number]>;
  /** Each ZCTA's land area in square miles. */
  land: Map<string, number>;
  /** One row per ZCTA and county, in the relationship file's order. */
  parts: ZctaPart[];
  /** ZCTAs with anyone living in them in 2010. */
  populated: Set<string>;
}

export async function usZctas(): Promise<Zctas> {
  const centroid = new Map<string, [number, number]>();
  const land = new Map<string, number>();
  let col: (n: string) => number = () => 0;
  eachRow(await cached(SOURCES.zctaGazetteer), "\t", (cells, i) => {
    if (i === 0) return void (col = columns(cells));
    centroid.set(cells[col("GEOID")], [Number(cells[col("INTPTLAT")]), Number(cells[col("INTPTLONG")])]);
    land.set(cells[col("GEOID")], Number(cells[col("ALAND_SQMI")]));
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

  return {
    centroid,
    land,
    parts: parts.map((p) => ({ zcta: p.zcta, state: STATE_FIPS[p.state], population: p.pop * growth(p.county, p.state) })),
    populated: new Set(parts.filter((p) => p.pop > 0).map((p) => p.zcta)),
  };
}
