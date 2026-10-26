// Making an event's hometown moments from its results: each athlete's homes
// sure enough for a moment, each town's circle, one moment per town, saved.
// Shared by the engine's hometown job and golf pollers and create_moment.
// Server-only: it reads lib/places.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACADEMIES, loadAthletes, momentHomes, placesOf, type AthletePlace, type AthleteResult } from "../athletes";
import { placeByKey, placeLabel, townCircle } from "../places";
import { deriveHometownMoments, type HometownEvent, type HometownMoment, type Local, type Town } from "./derive";
import { saveHometownMoments } from "./store";

/** Every town's moment, and the ones that were new. led has what each
 *  athlete led in the event, by athlete id. */
export async function makeHometownMoments(
  db: SupabaseClient,
  event: HometownEvent,
  results: AthleteResult[],
  led: Map<string, string[]> = new Map(),
): Promise<{ moments: HometownMoment[]; saved: HometownMoment[]; homes: number }> {
  const ids = results.map((r) => r.athleteId);
  const [athletes, places] = await Promise.all([loadAthletes(db, ids), placesOf(db, ids)]);
  const byAthlete = new Map<string, AthletePlace[]>();
  for (const p of places) byAthlete.set(p.athleteId, [...(byAthlete.get(p.athleteId) ?? []), p]);
  const result = new Map(results.map((r) => [r.athleteId, r]));
  const locals: Local[] = [];
  for (const a of athletes) {
    const homes = momentHomes(byAthlete.get(a.id) ?? [], ACADEMIES);
    if (homes.length) locals.push({ athlete: a, result: result.get(a.id)!, homes, led: led.get(a.id) });
  }
  const towns = new Map<string, Town>();
  for (const key of new Set(locals.flatMap((l) => l.homes.map((h) => h.placeKey)))) {
    const place = await placeByKey(key);
    if (place) towns.set(key, { place, label: placeLabel(place), circle: await townCircle(place) });
  }
  const moments = deriveHometownMoments(event, locals, towns);
  return { moments, saved: await saveHometownMoments(db, moments), homes: locals.length };
}
