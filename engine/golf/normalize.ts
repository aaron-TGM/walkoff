// ESPN's golf leaderboard into GolfEvents (types.ts).
import type { EspnGolfLeaderboard } from "./feed";
import type { GolfEvent, GolfPlayer, GolfState } from "./types";

/** "T3" is 3 and tied; "1" is 1; "CUT", "WD" and "-" are no place. */
function place(display: string | undefined): { position: number | null; tied: boolean } {
  const m = display?.trim().match(/^(T)?(\d+)$/i);
  return m ? { position: Number(m[2]), tied: !!m[1] } : { position: null, tied: false };
}

/** "-12" is -12, "E" is 0, "+3" is 3. */
function toPar(score: unknown): number | null {
  const display = typeof score === "string" ? score : (score as { displayValue?: string } | undefined)?.displayValue;
  const s = display?.trim();
  if (!s) return null;
  if (/^E$/i.test(s)) return 0;
  const n = Number(s.replace(/^\+/, ""));
  return Number.isFinite(n) ? n : null;
}

function stateOf(event: string | undefined, competition: { name?: string; state?: string } | undefined, eventCompleted: boolean): GolfState {
  const name = competition?.name ?? event ?? "";
  if (/CANCEL|POSTPONE/.test(name) || /CANCEL|POSTPONE/.test(event ?? "")) return "off";
  // Final only when both say so. "Round 3 - Play Complete" says complete too.
  if (competition?.name === "STATUS_FINAL" && (event === "STATUS_FINAL" || eventCompleted)) return "final";
  if (competition?.state === "pre" || name === "STATUS_SCHEDULED") return "pre";
  return "in";
}

export function normalizeLeaderboard(tour: string, board: EspnGolfLeaderboard): GolfEvent[] {
  const out: GolfEvent[] = [];
  for (const ev of board.events ?? []) {
    if (!ev.id || !ev.name || !ev.endDate) continue;
    const comp = ev.competitions?.[0];
    const status = comp?.status?.type;
    const players: GolfPlayer[] = [];
    for (const c of comp?.competitors ?? []) {
      const id = c.athlete?.id ?? c.id;
      const name = c.athlete?.displayName?.trim();
      if (!id || !name) continue;
      const { position, tied } = place(c.status?.position?.displayName);
      players.push({
        externalId: String(id),
        name,
        position,
        tied: tied || !!c.status?.position?.isTie,
        playoff: !!c.status?.playoff,
        toPar: toPar(c.score),
        period: c.status?.period ?? null,
        teeTime: c.status?.teeTime ?? null,
        rounds: (c.linescores ?? [])
          .filter((l) => typeof l.period === "number")
          .map((l) => ({ period: l.period!, strokes: typeof l.value === "number" && l.value > 0 ? l.value : null, teeTime: l.teeTime ?? null })),
      });
    }
    const statusName = status?.name ?? ev.status?.type?.name ?? "";
    const roundComplete = status?.completed === true || status?.name === "STATUS_PLAY_COMPLETE";
    const period = comp?.status?.period ?? null;
    out.push({
      id: `espn:golf:${ev.id}`,
      tour,
      externalId: ev.id,
      name: ev.name.trim(),
      startDate: ev.date ?? ev.endDate,
      endDate: ev.endDate,
      state: stateOf(ev.status?.type?.name, status, ev.status?.type?.completed === true),
      statusName,
      statusLine: `${statusName} ${period ?? "-"}${roundComplete ? " complete" : ""}`,
      roundComplete,
      period,
      rounds: ev.tournament?.numberOfRounds ?? (tour === "liv" ? 3 : 4),
      majorFlag: typeof ev.tournament?.major === "boolean" ? ev.tournament.major : null,
      players,
    });
  }
  return out;
}
