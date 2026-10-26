// ESPN's race weekends into the engine's shapes. Only the race counts: an F1
// weekend's practice, qualifying and sprint sessions don't.
import type { CircuitEvent, CircuitState, Entrant } from "../circuits/poller";
import type { EspnRacingScoreboard, EspnRacingStatusType } from "./feed";

export interface Race extends CircuitEvent {
  series: string;
  externalId: string;
  /** When the race itself starts. */
  raceDate: string;
  /** The feed's winner, once the race is final. */
  winner: Entrant | null;
}

function stateOf(t: EspnRacingStatusType | undefined): CircuitState {
  const name = t?.name ?? "";
  if (/CANCEL|POSTPONE/.test(name)) return "off";
  if (name === "STATUS_FINAL" || (t?.state === "post" && t.completed)) return "final";
  if (t?.state === "pre" || name === "STATUS_SCHEDULED") return "pre";
  return t?.state ? "in" : "pre";
}

export function normalizeRaces(series: string, board: EspnRacingScoreboard): Race[] {
  const out: Race[] = [];
  for (const ev of board.events ?? []) {
    const sessions = ev.competitions ?? [];
    const race = sessions.find((c) => c.type?.abbreviation === "Race") ?? (sessions.length === 1 && !sessions[0].type?.abbreviation ? sessions[0] : undefined);
    if (!ev.id || !ev.name || !race) continue;
    const players: Entrant[] = [];
    for (const c of race.competitors ?? []) {
      const name = (c.athlete?.displayName ?? c.athlete?.fullName)?.trim();
      if (c.id && name) players.push({ externalId: String(c.id), name });
    }
    const state = stateOf(race.status?.type);
    const won = state === "final" ? (race.competitors ?? []).filter((c) => c.winner === true) : [];
    const winner = won.length === 1 ? players.find((p) => p.externalId === String(won[0].id)) ?? null : null;
    // A weekend is under way while any session is, so the poller keeps up.
    const live = sessions.some((c) => stateOf(c.status?.type) === "in");
    out.push({
      id: `espn:racing:${ev.id}`,
      series,
      externalId: ev.id,
      name: ev.name.trim(),
      raceDate: race.date ?? ev.date ?? "",
      state: state === "pre" && live ? "in" : state,
      statusLine: `${race.status?.type?.name ?? ""}${live ? " (a session is live)" : ""}`,
      players,
      winner,
    });
  }
  return out;
}
