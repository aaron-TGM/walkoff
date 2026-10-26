// When a surfing event makes a hometown moment: its champions, men's and
// women's, within 60 hours of the end of its waiting period. Surfing has no
// contenders here: the article names the finalists only once it's over.
import type { Tour } from "../../lib/tours";
import type { CircuitOutcome, Entrant } from "../circuits/poller";
import type { SurfEvent } from "./normalize";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const SURFING = {
  /** The Pipe Masters, where the world titles are decided. */
  finale: 0.9,
  winHours: 60,
  /** A champion counts once the article has named them this long: a wrong
   *  edit is usually undone sooner. */
  settle: 30 * MINUTE,
};

const FINALE = /\bpipe(line)? masters\b/i;

export const isFinale = (name: string) => FINALE.test(name);

/** One outcome for the event: both champions are from the same town now
 *  and then, and the town gets one moment for the two. */
export function surfingOutcome(e: SurfEvent, tour: Tour, now: number, champions: Entrant[] = e.champions): CircuitOutcome | null {
  if (e.state === "off" || !champions.length || !e.endsOn) return null;
  if (now - Date.parse(`${e.endsOn}T23:59:59Z`) > SURFING.winHours * HOUR) return null;
  return {
    kind: "win",
    eventKey: e.key,
    eventName: e.name,
    players: champions,
    intensity: isFinale(e.name) ? SURFING.finale : tour.winIntensity,
    startsAt: null,
  };
}
