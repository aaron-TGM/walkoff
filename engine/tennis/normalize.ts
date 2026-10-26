// ESPN's tennis tournaments into the engine's shapes: each tour's own
// singles draw, the ATP's men's and the WTA's women's. A Slam is on both
// feeds; each tour takes its own draw, so each final counts once. Doubles
// aren't followed.
import type { CircuitEvent, CircuitState, Entrant } from "../circuits/poller";
import type { EspnTennisScoreboard, EspnTennisStatusType } from "./feed";

export const DRAW: Record<string, string> = { atp: "mens-singles", wta: "womens-singles" };

export interface TennisMatch {
  date: string | null;
  state: CircuitState;
  /** Who's in it, once the feed knows: no "TBD". */
  players: Entrant[];
  /** Once the match is over, by play, retirement or walkover. */
  winner: Entrant | null;
}

export interface TennisEvent extends CircuitEvent {
  tour: string;
  externalId: string;
  startDate: string;
  endDate: string;
  /** What the feed says: true for a Grand Slam. */
  major: boolean;
  /** The singles final, once it's in the draw. */
  final: TennisMatch | null;
}

function stateOf(t: EspnTennisStatusType | undefined): CircuitState {
  const name = t?.name ?? "";
  if (/CANCEL|POSTPONE/.test(name)) return "off";
  if (t?.state === "post" && t.completed) return "final";
  if (t?.state === "pre" || name === "STATUS_SCHEDULED") return "pre";
  return t?.state ? "in" : "pre";
}

type Match = NonNullable<NonNullable<NonNullable<EspnTennisScoreboard["events"]>[number]["groupings"]>[number]["competitions"]>[number];

function entrants(m: Match): Entrant[] {
  return (m.competitors ?? []).flatMap((c) => {
    const name = c.athlete?.displayName?.trim();
    return c.id && name && name !== "TBD" ? [{ externalId: String(c.id), name }] : [];
  });
}

function match(m: Match): TennisMatch {
  const state = stateOf(m.status?.type);
  const players = entrants(m);
  const won = state === "final" ? (m.competitors ?? []).filter((c) => c.winner === true) : [];
  return {
    date: m.date ?? null,
    state,
    players,
    winner: won.length === 1 ? (players.find((p) => p.externalId === String(won[0].id)) ?? null) : null,
  };
}

export function normalizeTennis(tour: string, board: EspnTennisScoreboard): TennisEvent[] {
  const out: TennisEvent[] = [];
  for (const ev of board.events ?? []) {
    const draw = ev.groupings?.find((g) => g.grouping?.slug === DRAW[tour]);
    if (!ev.id || !ev.name || !draw) continue;
    const matches = draw.competitions ?? [];
    const field = new Map<string, Entrant>();
    for (const m of matches) for (const p of entrants(m)) field.set(p.externalId, p);
    const raw = matches.find((m) => m.round?.displayName === "Final");
    const final = raw ? match(raw) : null;
    const states = matches.map((m) => stateOf(m.status?.type));
    const done = states.filter((s) => s === "final").length;
    const state: CircuitState = /CANCEL|POSTPONE/.test(ev.status?.type?.name ?? "")
      ? "off"
      : final?.state === "final"
        ? "final"
        : states.some((s) => s === "in" || s === "final")
          ? "in"
          : "pre";
    out.push({
      id: `espn:tennis:${ev.id}`,
      tour,
      externalId: ev.id,
      name: ev.name.trim(),
      startDate: ev.date ?? "",
      endDate: ev.endDate ?? ev.date ?? "",
      major: ev.major === true,
      state,
      statusLine: `${done} of ${matches.length} matches done; final ${final ? (raw?.status?.type?.name ?? final.state) : "not drawn"}`,
      players: [...field.values()],
      final,
    });
  }
  return out;
}
