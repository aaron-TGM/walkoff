// Athletes and where they're from, for hometown moments. See
// supabase/009_athletes.sql and data/athletes/curated.json.
export {
  HOME,
  homePlaces,
  isAcademy,
  momentHomes,
  sourceConfidence,
  type AthletePlace,
  type Home,
  type PlaceKind,
  type PlaceSource,
  type Resolution,
} from "./homes";
export { ACADEMIES, athletePlace, CURATED_HOMES, curatedPlace, type CuratedHome } from "./places";
export {
  athleteId,
  athletesReady,
  loadAthletes,
  namingRights,
  placesOf,
  saveAthletes,
  savePlaces,
  saveResults,
  type Athlete,
  type AthleteResult,
  type AthleteRight,
  type ResultKind,
  type ResultRole,
} from "./store";
