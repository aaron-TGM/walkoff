// Downloads and caches the public reference files the build scripts use.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";

const CACHE = join(process.cwd(), ".cache", "geo");

export const SOURCES = {
  zctaGazetteer:
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip",
  placeGazetteer:
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip",
  countySubdivisionGazetteer:
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_cousubs_national.zip",
  zctaCounty2010: "https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt",
  countyEstimates:
    "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv",
  geonamesCA: "https://download.geonames.org/export/zip/CA_full.csv.zip",
  geonamesGB: "https://download.geonames.org/export/zip/GB_full.csv.zip",
  geonamesUS: "https://download.geonames.org/export/zip/US.zip",
  geonamesCities: "https://download.geonames.org/export/dump/cities500.zip",
  onsPostcodeHeadcounts: "https://www.nomisweb.co.uk/output/census/2021/pcd_p001.csv",
} as const;

/** Fetches a URL once and keeps it in .cache/geo. Zips are unpacked to the
 *  first file inside. */
export async function cached(url: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const name = url.split("/").pop()!.replace(/\.zip$/, ".txt");
  const path = join(CACHE, name);
  if (!existsSync(path)) {
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (url.endsWith(".zip")) {
      const files = unzipSync(bytes, { filter: (f) => !f.name.toLowerCase().includes("readme") });
      const first = Object.values(files)[0];
      if (!first) throw new Error(`Empty zip ${url}`);
      writeFileSync(path, strFromU8(first));
    } else {
      writeFileSync(path, bytes);
    }
  }
  return readFileSync(path, "utf8");
}

/** Calls fn with each non-empty line's cells. None of these sources quote
 *  fields, so a plain split is enough. Avoids holding millions of rows. */
export function eachRow(text: string, sep: string, fn: (cells: string[], index: number) => void): void {
  let start = 0;
  let index = 0;
  while (start < text.length) {
    let end = text.indexOf("\n", start);
    if (end < 0) end = text.length;
    const line = text.slice(start, end).replace(/\r$/, "");
    if (line.trim()) fn(line.split(sep), index++);
    start = end + 1;
  }
}

/** Header row to column index lookup. */
export function columns(header: string[]): (name: string) => number {
  return (name) => {
    const i = header.findIndex((h) => h.trim().toUpperCase() === name.toUpperCase());
    if (i < 0) throw new Error(`Column ${name} not found in ${header.join(",")}`);
    return i;
  };
}

export const STATE_FIPS: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR",
};

export const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN",
  iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto rico": "PR",
};
