// The town data scripts/build-places.ts writes (see data/geo/README.md),
// loaded the first time something asks for it. Server-only: it's about
// 4.5 MB, so it comes in through import(), and nothing a browser loads may
// import lib/places (places.test.ts checks).
import type { Country } from "../affinity/geo";
import { nameKey } from "./names";

export interface Place {
  /** "census:0665084", "cousub:3400712280", "zip:92624", "geonames:2646670". */
  key: string;
  /** The name people use: "San Clemente", "Nashville". */
  name: string;
  /** Every name it goes by, that one first: ["Nashville", "Nashville-Davidson"]. */
  names: string[];
  country: Country;
  /** State or province code, or the UK nation: "CA", "SK", "NIR". */
  region: string;
  lat: number;
  lng: number;
  /** The postal code nearest its center, where Klaviyo centers a circle:
   *  "92673", "S7K 1N5", "BT18 9DE". */
  ref: string;
  /** Roughly how far the town reaches from its center, in miles: from its
   *  land area in the US, and from its population in Canada and the UK (at
   *  2,500 people a square mile). */
  radius: number;
  /** Part of a bigger city (a GeoNames neighborhood, like Richmond Heights
   *  in Saskatoon): found by its name, but never the town at a point. */
  section: boolean;
}

export interface PlaceTable {
  places: Place[];
  byKey: Map<string, Place>;
  /** Every place by each of its names' keys (names.ts). */
  byName: Map<string, Place[]>;
  /** How strongly a place claims a name it shares: 1 for a US place with
   *  its own government (0 otherwise), the population in Canada and the UK. */
  weight: Map<Place, number>;
}

export interface Zip {
  zip: string;
  lat: number;
  lng: number;
  population: number;
  /** The ZIP's postal name, the town people there write: "San Clemente".
   *  Empty for a few. */
  name: string;
  /** Its state. */
  region: string;
}

interface Table {
  fields: string[];
  rows: string;
}

const PLACE_FILES: Record<Country, () => Promise<{ default: Table }>> = {
  US: () => import("../../data/geo/places-us.json"),
  CA: () => import("../../data/geo/places-ca.json"),
  GB: () => import("../../data/geo/places-gb.json"),
};

const TOWN_DENSITY = 2_500;

function cells(t: Table): { col: (name: string) => number; rows: string[][] } {
  return {
    col: (name) => t.fields.indexOf(name),
    rows: t.rows.split("\n").map((line) => line.split("\t")),
  };
}

function parsePlaces(country: Country, t: Table): PlaceTable {
  const { col, rows } = cells(t);
  const [key, names, region, lat, lng, ref, land, rank, population, section] = [
    "key", "names", "region", "lat", "lng", "ref", "land", "rank", "population", "section",
  ].map(col);
  const table: PlaceTable = { places: [], byKey: new Map(), byName: new Map(), weight: new Map() };
  for (const c of rows) {
    const all = c[names].split("|");
    const people = population >= 0 ? Number(c[population]) : 0;
    const place: Place = {
      key: c[key],
      name: all[0],
      names: all,
      country,
      region: c[region],
      lat: Number(c[lat]),
      lng: Number(c[lng]),
      ref: c[ref],
      radius: Math.sqrt((land >= 0 ? Number(c[land]) : people / TOWN_DENSITY) / Math.PI),
      section: section >= 0 && c[section] === "1",
    };
    table.places.push(place);
    table.byKey.set(place.key, place);
    table.weight.set(place, rank >= 0 ? Number(c[rank]) : people);
    for (const k of new Set(all.map(nameKey))) {
      const list = table.byName.get(k);
      if (list) list.push(place);
      else table.byName.set(k, [place]);
    }
  }
  return table;
}

const placeTables = new Map<Country, Promise<PlaceTable>>();
let zipTable: Promise<Map<string, Zip>> | undefined;

/** One country's places. */
export function loadPlaces(country: Country): Promise<PlaceTable> {
  let t = placeTables.get(country);
  if (!t) {
    t = PLACE_FILES[country]().then((m) => parsePlaces(country, m.default));
    t.catch(() => placeTables.delete(country));
    placeTables.set(country, t);
  }
  return t;
}

/** Every US ZIP with people in it. */
export function loadZips(): Promise<Map<string, Zip>> {
  if (!zipTable) {
    zipTable = import("../../data/geo/zip5.json").then(({ default: t }) => {
      const { col, rows } = cells(t);
      const [zip, lat, lng, population, name, region] = ["zip", "lat", "lng", "population", "name", "region"].map(col);
      return new Map(
        rows.map((c): [string, Zip] => [
          c[zip],
          {
            zip: c[zip],
            lat: Number(c[lat]),
            lng: Number(c[lng]),
            population: Number(c[population]),
            name: c[name] ?? "",
            region: c[region] ?? "",
          },
        ]),
      );
    });
    zipTable.catch(() => (zipTable = undefined));
  }
  return zipTable;
}
