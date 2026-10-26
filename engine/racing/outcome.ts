// When a race makes a hometown moment: its winner, once the race is final,
// within 60 hours of its start. Racing has no contenders: a pole position
// isn't a moment.
import type { Tour } from "../../lib/tours";
import type { CircuitOutcome } from "../circuits/poller";
import type { Race } from "./normalize";

const HOUR = 3_600_000;

export const RACING = {
  /** The Daytona 500 and the Indianapolis 500. */
  major: 0.95,
  winHours: 60,
};

const MAJORS = [/^daytona 500$/i, /^indianapolis 500\b/i];
/** Qualifying races that aren't the event: Daytona's Duels. */
const NOT_A_RACE = /\bduel\b/i;

export const isMajorRace = (name: string) => MAJORS.some((m) => m.test(name.trim()));

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const raceKey = (tour: Tour, r: Pick<Race, "name" | "raceDate">) => `racing:${tour.id}:${slug(r.name)}:${r.raceDate.slice(0, 10)}`;

export function raceOutcome(r: Race, tour: Tour, now: number): CircuitOutcome | null {
  if (r.state !== "final" || !r.winner || NOT_A_RACE.test(r.name)) return null;
  if (!r.raceDate || now - Date.parse(r.raceDate) > RACING.winHours * HOUR) return null;
  return {
    kind: "win",
    eventKey: raceKey(tour, r),
    eventName: r.name,
    players: [r.winner],
    intensity: isMajorRace(r.name) ? RACING.major : tour.winIntensity,
    startsAt: null,
  };
}
