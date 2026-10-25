// Where an athlete is from, ranked from what each source says. An
// operator's word replaces everything, then the curated file's. Otherwise a
// high school beats a birthplace: Sam Darnold was born in Capistrano Beach
// and grew up in San Clemente, 4 miles away.
import { haversineKm, type Country } from "../affinity/geo";
import { nameKey } from "../places/names";

export type PlaceKind = "birthplace" | "high_school" | "hometown";
export type PlaceSource = "espn" | "wikidata" | "curated" | "operator";
export type Resolution = "found" | "ambiguous" | "unknown" | "outside";

/** One source's word on where an athlete is from (athlete_places). */
export interface AthletePlace {
  athleteId: string;
  kind: PlaceKind;
  source: PlaceSource;
  /** As the source has it: "Capistrano Beach, CA", "San Clemente High School". */
  raw: string;
  resolution: Resolution;
  placeKey: string | null;
  placeName: string | null;
  region: string | null;
  country: Country | null;
  lat: number | null;
  lng: number | null;
  /** Where Klaviyo centers the town's circle. */
  refCode: string | null;
  /** That code's postal area: "926". */
  area: string | null;
  /** False when an operator ruled it out. */
  active: boolean;
  note: string | null;
}

export interface Home {
  placeKey: string;
  name: string;
  region: string;
  country: Country;
  lat: number;
  lng: number;
  ref: string;
  area: string;
  confidence: number;
  /** Every source that puts the athlete here, the strongest first. */
  from: { kind: PlaceKind; source: PlaceSource; raw: string }[];
}

export const HOME = {
  /** Below this, a home makes no hometown moment. */
  minConfidence: 0.6,
  /** Places this close are one home. */
  mergeMiles: 25,
  /** A high school this far from the birthplace may be a boarding school. */
  schoolMiles: 100,
  /** What a boarding academy, or a far-off high school, counts for. */
  doubtful: 0.5,
  /** Homes per athlete, at most. */
  max: 2,
};

/** What each source's word counts for, before any doubt. */
const CONFIDENCE: Record<string, number> = {
  "hometown:operator": 1,
  "hometown:curated": 0.95,
  "high_school:wikidata": 0.9,
  "birthplace:espn": 0.7,
  "birthplace:wikidata": 0.65,
};
const BY_KIND: Record<PlaceKind, number> = { hometown: 0.9, high_school: 0.85, birthplace: 0.65 };

/** What a source's word on a kind of place counts for, before any doubt. */
export function sourceConfidence(kind: PlaceKind, source: PlaceSource): number {
  return CONFIDENCE[`${kind}:${source}`] ?? BY_KIND[kind];
}

const miles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a, b) / 1.609344;

type Located = AthletePlace & { placeKey: string; country: Country; lat: number; lng: number; refCode: string };

function located(p: AthletePlace): p is Located {
  return p.active && p.resolution === "found" && !!p.placeKey && !!p.country && p.lat !== null && p.lng !== null && !!p.refCode;
}

/** A boarding school on the academies list (data/athletes/curated.json). */
export function isAcademy(school: string, academies: string[]): boolean {
  const key = nameKey(school);
  return academies.some((a) => key.includes(nameKey(a)));
}

function home(p: Located, confidence: number): Home {
  return {
    placeKey: p.placeKey,
    name: p.placeName ?? p.raw,
    region: p.region ?? "",
    country: p.country,
    lat: p.lat,
    lng: p.lng,
    ref: p.refCode,
    area: p.area ?? "",
    confidence,
    from: [{ kind: p.kind, source: p.source, raw: p.raw }],
  };
}

/** Where the athlete is from, at most two homes, the likeliest first.
 *  Places within 25 miles are one home. Two homes need two kinds of
 *  evidence (born in one town, school in another): two birthplaces that
 *  disagree can't both be right, so the weaker one counts for nothing. */
export function homePlaces(places: AthletePlace[], academies: string[] = []): Home[] {
  const usable = places.filter(located);
  for (const source of ["operator", "curated"] as const) {
    const said = usable.filter((p) => p.kind === "hometown" && p.source === source);
    if (said.length) return said.slice(0, HOME.max).map((p) => home(p, sourceConfidence("hometown", source)));
  }
  const birth = usable.find((p) => p.kind === "birthplace" && p.source === "espn") ?? usable.find((p) => p.kind === "birthplace");
  const scored = usable
    .map((p) => {
      let c = sourceConfidence(p.kind, p.source);
      if (p.kind === "high_school" && (isAcademy(p.raw, academies) || (birth && miles(p, birth) > HOME.schoolMiles))) {
        c = Math.min(c, HOME.doubtful);
      }
      return { p, c };
    })
    .sort((a, b) => b.c - a.c);
  const homes: Home[] = [];
  for (const { p, c } of scored) {
    const near = homes.find((h) => miles(h, p) <= HOME.mergeMiles);
    if (near) near.from.push({ kind: p.kind, source: p.source, raw: p.raw });
    else if (!homes.some((h) => h.from.some((f) => f.kind === p.kind))) homes.push(home(p, c));
  }
  return homes.slice(0, HOME.max);
}

/** The homes sure enough for a hometown moment. */
export function momentHomes(places: AthletePlace[], academies: string[] = []): Home[] {
  return homePlaces(places, academies).filter((h) => h.confidence >= HOME.minConfidence);
}
