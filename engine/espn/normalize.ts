import { rulesFor } from "../moments/sports";
import type {
  GameState,
  GoalEvent,
  ScoringEvent,
  SeriesInfo,
  Side,
  Sport,
  TeamRef,
} from "../moments/types";
import type {
  EspnCompetition,
  EspnCompetitor,
  EspnEvent,
  EspnScoreboard,
  EspnSummary,
  EspnTeam,
} from "./types";

export function teamId(league: string, externalId: string): string {
  return `espn:${league}:${externalId}`;
}

export function gameId(league: string, externalId: string): string {
  return `espn:${league}:${externalId}`;
}

/** "90'+3'" -> 93, "45'+1'" -> 46, "78'" -> 78. */
export function parseMinute(display: string | undefined): number | null {
  const m = display?.match(/^\s*(\d+)'?\s*(?:\+\s*(\d+))?/);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

/** "5:23" -> 323, "1.4" -> 1.4, "0:00" -> 0. */
export function parseClock(display: string | undefined): number | null {
  if (!display) return null;
  const parts = display.trim().split(":");
  if (parts.length === 2) {
    const [min, sec] = parts.map(Number);
    return Number.isFinite(min) && Number.isFinite(sec) ? min * 60 + sec : null;
  }
  const n = Number(display);
  return Number.isFinite(n) ? n : null;
}

function parseInningHalf(detail: string): GameState["inningHalf"] {
  const word = detail.trim().split(/\s+/)[0]?.toLowerCase();
  if (word === "top") return "top";
  if (word === "bot" || word === "bottom") return "bottom";
  if (word === "mid" || word === "middle") return "mid";
  if (word === "end") return "end";
  return null;
}

function toTeam(league: string, t: EspnTeam | undefined): TeamRef | null {
  if (!t?.id) return null;
  const displayName = t.displayName ?? t.name ?? t.abbreviation ?? t.id;
  return {
    id: teamId(league, t.id),
    league,
    externalId: t.id,
    abbreviation: t.abbreviation ?? "",
    displayName,
    shortName: t.shortDisplayName ?? t.name ?? displayName,
    location: t.location ?? "",
    color: t.color ?? null,
    alternateColor: t.alternateColor ?? null,
  };
}

function toSide(league: string, c: EspnCompetitor): Side | null {
  const team = toTeam(league, c.team);
  if (!team) return null;
  const score = Number.parseInt(c.score ?? "0", 10);
  return {
    team,
    score: Number.isFinite(score) ? score : 0,
    winner: typeof c.winner === "boolean" ? c.winner : null,
    linescores: (c.linescores ?? []).map((l) =>
      typeof l.value === "number" ? l.value : 0,
    ),
    record: c.records?.find((r) => r.type === "total")?.summary ?? null,
  };
}

function toGoals(comp: EspnCompetition): GoalEvent[] {
  // The feed lists goals in match order. Don't sort by minute: a 45'+2'
  // first-half goal comes before a 46' second-half goal.
  return (comp.details ?? [])
    .filter((d) => d.scoringPlay && d.team?.id)
    .map((d) => ({
      minute: parseMinute(d.clock?.displayValue) ?? 0,
      display: d.clock?.displayValue ?? "",
      teamExternalId: d.team?.id ?? "",
      ownGoal: Boolean(d.ownGoal),
      penalty: Boolean(d.penaltyKick),
    }));
}

function toSeries(comp: EspnCompetition): SeriesInfo | null {
  const s = comp.series;
  if (!s || s.type !== "playoff") return null;
  let winnerExternalId: string | null = null;
  if (s.completed) {
    const best = [...(s.competitors ?? [])].sort(
      (a, b) => (b.wins ?? 0) - (a.wins ?? 0),
    )[0];
    winnerExternalId = best?.id ?? null;
  }
  return { completed: Boolean(s.completed), summary: s.summary ?? "", winnerExternalId };
}

export function normalizeEvent(league: string, ev: EspnEvent): GameState | null {
  const comp = ev.competitions?.[0];
  if (!ev.id || !comp) return null;
  const sport = rulesFor(league).sport;

  let home: Side | null = null;
  let away: Side | null = null;
  for (const c of comp.competitors ?? []) {
    if (c.homeAway === "home") home = toSide(league, c);
    else if (c.homeAway === "away") away = toSide(league, c);
  }
  if (!home || !away) return null;

  const status = comp.status ?? ev.status ?? {};
  const type = status.type ?? {};
  const statusDetail = type.shortDetail ?? type.detail ?? "";
  const timed = sport === "football" || sport === "basketball" || sport === "hockey";
  const sit = comp.situation;

  return {
    id: gameId(league, ev.id),
    league,
    sport,
    externalId: ev.id,
    name: ev.name ?? `${away.team.displayName} at ${home.team.displayName}`,
    shortName: ev.shortName ?? `${away.team.abbreviation} @ ${home.team.abbreviation}`,
    startsAt: new Date(comp.date ?? ev.date ?? Date.now()).toISOString(),
    state: type.state ?? "pre",
    completed: Boolean(type.completed),
    statusDetail,
    period: status.period ?? 0,
    clockSeconds: timed && typeof status.clock === "number" ? status.clock : null,
    minute: sport === "soccer" ? parseMinute(status.displayClock) : null,
    inningHalf: sport === "baseball" ? parseInningHalf(statusDetail) : null,
    seasonType: ev.season?.type ?? 2,
    headline: comp.notes?.find((n) => n.headline)?.headline ?? null,
    neutralSite: Boolean(comp.neutralSite),
    home,
    away,
    goals: sport === "soccer" ? toGoals(comp) : [],
    situation: sit
      ? {
          onFirst: Boolean(sit.onFirst),
          onSecond: Boolean(sit.onSecond),
          onThird: Boolean(sit.onThird),
          outs: typeof sit.outs === "number" ? sit.outs : null,
          possessionExternalId: sit.possession ?? null,
        }
      : null,
    series: toSeries(comp),
  };
}

export function normalizeScoreboard(league: string, board: EspnScoreboard): GameState[] {
  const games: GameState[] = [];
  for (const ev of board.events ?? []) {
    const g = normalizeEvent(league, ev);
    if (g) games.push(g);
  }
  return games;
}

/** Score changes from a game summary, oldest first. */
export function scoringEventsFromSummary(sport: Sport, summary: EspnSummary): ScoringEvent[] {
  if (sport === "football") {
    return (summary.scoringPlays ?? []).map((p) => ({
      period: p.period?.number ?? 0,
      clock: p.clock?.value ?? parseClock(p.clock?.displayValue) ?? 0,
      homeScore: p.homeScore ?? 0,
      awayScore: p.awayScore ?? 0,
      teamExternalId: p.team?.id ?? null,
      text: p.text ?? "",
    }));
  }
  if (sport === "basketball") {
    return (summary.plays ?? [])
      .filter((p) => p.scoringPlay)
      .map((p) => ({
        period: p.period?.number ?? 0,
        clock: parseClock(p.clock?.displayValue) ?? 0,
        homeScore: p.homeScore ?? 0,
        awayScore: p.awayScore ?? 0,
        teamExternalId: p.team?.id ?? null,
        text: p.text ?? "",
      }));
  }
  return [];
}
