// When a golf event makes a hometown moment: its winner once the event is
// final, and never before (after round 3 the feed calls the round complete
// too), and whoever leads going into the final round, once their tee times
// are out.
import type { Tour } from "../../lib/tours";
import { GOLF, isMajor, winIntensity } from "./majors";
import type { GolfEvent, GolfPlayer } from "./types";

export interface GolfOutcome {
  kind: "win" | "lead";
  /** "golf:masters-tournament:2026-04-12": the same on every tour's feed,
   *  so an event two tours share counts once. */
  eventKey: string;
  eventName: string;
  players: GolfPlayer[];
  intensity: number;
  /** Contenders: the first final-round tee time among them. */
  startsAt: string | null;
}

const HOUR = 3_600_000;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const golfEventKey = (e: Pick<GolfEvent, "name" | "endDate">) => `golf:${slug(e.name)}:${e.endDate.slice(0, 10)}`;

/** A player's final-round tee time: on the round's line, or the status when
 *  it's about that round. */
function finalTee(p: GolfPlayer, rounds: number): string | null {
  return p.rounds.find((r) => r.period === rounds)?.teeTime ?? (p.period === rounds ? p.teeTime : null);
}

export function golfOutcome(e: GolfEvent, tour: Tour, now: number): GolfOutcome | null {
  const base = { eventKey: golfEventKey(e), eventName: e.name };
  if (e.state === "final") {
    if (now - Date.parse(e.endDate) > GOLF.winHours * HOUR) return null;
    // One winner, or none: a tie for first with the event final is a feed
    // slip, not two champions.
    const winners = e.players.filter((p) => p.position === 1 && !p.tied);
    if (winners.length !== 1) return null;
    const w = winners[0];
    const intensity = Math.min(1, Math.round((winIntensity(tour, e.name) + (w.playoff ? GOLF.playoff : 0)) * 100) / 100);
    return { ...base, kind: "win", players: [w], intensity, startsAt: null };
  }
  if (e.state === "in" && e.roundComplete && e.period === e.rounds - 1) {
    const leaders = e.players.filter((p) => p.position === 1);
    const tees = leaders
      .map((p) => finalTee(p, e.rounds))
      .filter((t): t is string => !!t && Date.parse(t) > now)
      .sort();
    if (!leaders.length || !tees.length) return null;
    return { ...base, kind: "lead", players: leaders, intensity: isMajor(e.name) ? GOLF.contenderMajor : GOLF.contender, startsAt: tees[0] };
  }
  return null;
}
