// Hometown moments: a town celebrates when someone from there wins. See
// derive.ts, and engine/hometown.ts for when they're made.
export {
  deriveHometownMoments,
  HOMETOWN_TYPES,
  isHometownType,
  ROLE_INTENSITY,
  type HometownDetail,
  type HometownEvent,
  type HometownMoment,
  type HometownType,
  type Local,
  type Town,
} from "./derive";
export { hometownLive } from "./flag";
export { makeHometownMoments } from "./make";
export { saveHometownMoments } from "./store";
