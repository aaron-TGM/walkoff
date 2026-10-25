// Turning what a source says about an athlete into an athlete_places row,
// with the town lib/places found for it. The curated file
// (data/athletes/curated.json) is one such source.
import curated from "../../data/athletes/curated.json";
import { resolveTown, type Resolved } from "../places/resolve";
import type { AthletePlace, PlaceKind, PlaceSource } from "./homes";

export interface CuratedHome {
  /** "espn:football:3912547". */
  athlete: string;
  /** For the people who keep the file. */
  name: string;
  /** A town lib/places finds: "San Clemente, CA". */
  hometown: string;
  /** Where it came from: a link. */
  source: string;
  note?: string;
}

export const CURATED_HOMES: CuratedHome[] = curated.hometowns;

/** Boarding schools whose town isn't anyone's hometown. */
export const ACADEMIES: string[] = curated.academies;

/** The postal area a place's code is in, as brand_area_counts keeps it. */
function areaOf(country: string, ref: string): string {
  if (country === "GB") return ref.split(" ")[0];
  return ref.replace(/\s+/g, "").slice(0, 3);
}

/** A source's word on where an athlete is from, and the town it means. */
export function athletePlace(
  athleteId: string,
  kind: PlaceKind,
  source: PlaceSource,
  raw: string,
  resolved: Resolved,
  note: string | null = null,
): AthletePlace {
  const p = resolved.status === "found" ? resolved.place : null;
  return {
    athleteId,
    kind,
    source,
    raw,
    resolution: resolved.status,
    placeKey: p?.key ?? null,
    placeName: p?.name ?? null,
    region: p?.region ?? null,
    country: p?.country ?? null,
    lat: p?.lat ?? null,
    lng: p?.lng ?? null,
    refCode: p?.ref ?? null,
    area: p ? areaOf(p.country, p.ref) : null,
    active: true,
    note,
  };
}

/** A curated hometown as an athlete_places row. */
export async function curatedPlace(entry: CuratedHome): Promise<AthletePlace> {
  return athletePlace(entry.athlete, "hometown", "curated", entry.hometown, await resolveTown(entry.hometown), entry.note ?? null);
}
