// Towns: finding the one an athlete is from, and the circle around it a
// hometown campaign goes to. Server-only (see data.ts).
export { CIRCLE, townCircle, townCustomers, townLift, type TownCircle } from "./circle";
export { loadPlaces, loadZips, type Place } from "./data";
export { nameKey } from "./names";
export {
  miles,
  NATIONS,
  nearestPlace,
  placeByKey,
  placeLabel,
  resolvePlace,
  resolveTown,
  type Resolved,
} from "./resolve";
