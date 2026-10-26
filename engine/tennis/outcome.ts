// When a tennis tournament makes a hometown moment: its singles winner, once
// the final is over, within 60 hours of it; and both finalists before the
// final, once both are known and it's scheduled. Tiers by name, as ESPN
// doesn't say: the Slams (ESPN does flag those), the year-end Finals, and
// each tour's 1000-level events.
import type { Tour } from "../../lib/tours";
import type { CircuitOutcome } from "../circuits/poller";
import type { TennisEvent } from "./normalize";

const HOUR = 3_600_000;

export const TENNIS = {
  slam: 0.95,
  finals: 0.9,
  thousand: 0.85,
  /** A finalist before the final: under the default trigger's 0.6 except
   *  at a Slam. */
  finalistSlam: 0.7,
  finalist: 0.55,
  winHours: 60,
};

const SLAMS = [/australian open/i, /roland[- ]garros|french open/i, /wimbledon/i, /^(the )?u\.?s\.? open\b/i];
const FINALS: Record<string, RegExp> = { atp: /\batp finals\b/i, wta: /\bwta finals\b/i };
/** Each tour's 1000s. Beijing, Dubai and Doha are 1000s for the WTA only. */
const THOUSANDS: Record<string, RegExp[]> = {
  atp: [/bnp paribas open|indian wells/i, /miami open/i, /monte[- ]carlo/i, /madrid open/i, /internazionali|italian open/i, /national bank open|omnium banque nationale|canadian open/i, /cincinnati open|western (&|and) southern/i, /shanghai masters/i, /paris masters/i],
  wta: [/qatar .*open|doha/i, /dubai duty free/i, /bnp paribas open|indian wells/i, /miami open/i, /madrid open/i, /internazionali|italian open/i, /national bank open|omnium banque nationale|canadian open/i, /cincinnati open|western (&|and) southern/i, /wuhan open/i, /china open/i],
};

export type TennisTier = "slam" | "finals" | "thousand" | "tour";

export function tennisTier(tour: string, e: Pick<TennisEvent, "name" | "major">): TennisTier {
  if (e.major || SLAMS.some((s) => s.test(e.name))) return "slam";
  if (FINALS[tour]?.test(e.name)) return "finals";
  if (THOUSANDS[tour]?.some((t) => t.test(e.name))) return "thousand";
  return "tour";
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const tennisKey = (tour: Tour, e: Pick<TennisEvent, "name" | "startDate">) => `tennis:${tour.id}:${slug(e.name)}:${e.startDate.slice(0, 4)}`;

export function tennisOutcomes(e: TennisEvent, tour: Tour, now: number): CircuitOutcome[] {
  const f = e.final;
  if (!f || !f.date) return [];
  const tier = tennisTier(tour.id, e);
  const base = { eventKey: tennisKey(tour, e), eventName: e.name };
  if (f.state === "final") {
    if (!f.winner || now - Date.parse(f.date) > TENNIS.winHours * HOUR) return [];
    const intensity = tier === "slam" ? TENNIS.slam : tier === "finals" ? TENNIS.finals : tier === "thousand" ? TENNIS.thousand : tour.winIntensity;
    return [{ ...base, kind: "win", players: [f.winner], intensity, startsAt: null }];
  }
  if (f.state === "pre" && f.players.length === 2 && Date.parse(f.date) > now) {
    return [{ ...base, kind: "lead", players: f.players, intensity: tier === "slam" ? TENNIS.finalistSlam : TENNIS.finalist, startsAt: f.date }];
  }
  return [];
}
