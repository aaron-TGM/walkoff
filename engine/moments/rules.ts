import { findRivalry } from "./rivalries";
import type { LeagueRules } from "./sports";
import type {
  GameState,
  HomeAway,
  Moment,
  MomentType,
  Phase,
  ScoringEvent,
  Side,
  TrackedGame,
} from "./types";

const HOUR_MS = 3_600_000;
const SIDES: HomeAway[] = ["home", "away"];

const PHASE: Record<MomentType, Phase> = {
  rivalry_preview: "before",
  big_game_alert: "before",
  season_opener: "before",
  team_win: "after",
  close_game: "during",
  comeback_live: "during",
  clutch_moment: "during",
  walkoff_win: "after",
  buzzer_beater: "after",
  late_winner: "after",
  comeback_win: "after",
  rivalry_win: "after",
  heartbreak_loss: "after",
  playoff_advance: "season",
  title_won: "season",
};

const TITLE_SERIES = /world series|nba finals|stanley cup final/i;
const TITLE_GAME = /super bowl|national championship/i;
const NOT_COMPETITIVE = /pro bowl|all-star|exhibition/i;
const BIG_GAME = /championship|final|bowl|playoff/i;

const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

// ── Helpers ────────────────────────────────────────────────────────

function sideOf(g: GameState, side: HomeAway): Side {
  return side === "home" ? g.home : g.away;
}

function other(side: HomeAway): HomeAway {
  return side === "home" ? "away" : "home";
}

function diffFor(g: GameState, side: HomeAway): number {
  return sideOf(g, side).score - sideOf(g, other(side)).score;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function postseasonBoost(g: GameState): number {
  return g.seasonType === 3 ? 0.1 : 0;
}

/** "Eagles 27, Cowboys 24" with the given side first. */
function scoreLine(g: GameState, first: HomeAway): string {
  const a = sideOf(g, first);
  const b = sideOf(g, other(first));
  return `${a.team.shortName} ${a.score}, ${b.team.shortName} ${b.score}`;
}

function matchup(g: GameState): string {
  return `${g.away.team.shortName} ${g.neutralSite ? "vs" : "at"} ${g.home.team.shortName}`;
}

export function kickoffLabel(iso: string): string {
  return `${ET.format(new Date(iso))} ET`;
}

function moment(
  g: GameState,
  type: MomentType,
  side: HomeAway,
  headline: string,
  intensity: number,
  detail: Record<string, unknown>,
  occurredAt: string,
): Moment {
  const team = sideOf(g, side).team;
  return {
    dedupeKey: `${type}:${g.id}:${team.id}`,
    type,
    category: "sports",
    phase: PHASE[type],
    league: g.league,
    gameId: g.id,
    team,
    opponent: sideOf(g, other(side)).team,
    headline,
    intensity: clamp01(intensity),
    detail: {
      matchup: g.shortName,
      status: g.statusDetail,
      home: { team: g.home.team.abbreviation, score: g.home.score },
      away: { team: g.away.team.abbreviation, score: g.away.score },
      gameHeadline: g.headline,
      postseason: g.seasonType === 3,
      ...detail,
    },
    occurredAt,
  };
}

// ── Deficits ───────────────────────────────────────────────────────

export interface Deficits {
  home: number;
  away: number;
}

function bump(d: Deficits, homeScore: number, awayScore: number): void {
  d.home = Math.max(d.home, awayScore - homeScore);
  d.away = Math.max(d.away, homeScore - awayScore);
}

function merge(d: Deficits, more: Deficits): void {
  d.home = Math.max(d.home, more.home);
  d.away = Math.max(d.away, more.away);
}

/** Largest deficits visible in the line score: after every half inning for
 *  baseball, after every period for everything else. */
export function linescoreDeficits(g: GameState): Deficits {
  const d = { home: 0, away: 0 };
  let h = 0;
  let a = 0;
  const n = Math.max(g.home.linescores.length, g.away.linescores.length);
  for (let i = 0; i < n; i++) {
    a += g.away.linescores[i] ?? 0;
    if (g.sport === "baseball") bump(d, h, a);
    h += g.home.linescores[i] ?? 0;
    bump(d, h, a);
  }
  return d;
}

export function eventDeficits(events: ScoringEvent[]): Deficits {
  const d = { home: 0, away: 0 };
  for (const e of events) bump(d, e.homeScore, e.awayScore);
  return d;
}

/** Soccer goals as running-score events. Own goals are already credited to
 *  the team that benefits. */
export function goalScoringEvents(g: GameState): ScoringEvent[] {
  let h = 0;
  let a = 0;
  return g.goals.map((goal) => {
    if (goal.teamExternalId === g.home.team.externalId) h++;
    else if (goal.teamExternalId === g.away.team.externalId) a++;
    return {
      period: goal.minute > 45 ? 2 : 1,
      clock: goal.minute,
      homeScore: h,
      awayScore: a,
      teamExternalId: goal.teamExternalId,
      text: goal.ownGoal ? `Own goal ${goal.display}` : `Goal ${goal.display}`,
    };
  });
}

/** The score after which the winner led for good. */
export function decisiveScore(
  events: ScoringEvent[],
  winner: HomeAway,
): ScoringEvent | null {
  let decisive: ScoringEvent | null = null;
  let leader: HomeAway | null = null;
  for (const e of events) {
    const now: HomeAway | null =
      e.homeScore > e.awayScore ? "home" : e.awayScore > e.homeScore ? "away" : null;
    if (now === winner && leader !== winner) decisive = e;
    leader = now;
  }
  // Missing plays can leave the feed's last score out of step with the final.
  return leader === winner ? decisive : null;
}

// ── Tracking between polls ─────────────────────────────────────────

export function track(prev: TrackedGame | null, game: GameState, now: Date): TrackedGame {
  const d = { home: prev?.maxHomeDeficit ?? 0, away: prev?.maxAwayDeficit ?? 0 };
  bump(d, game.home.score, game.away.score);
  merge(d, linescoreDeficits(game));
  if (game.sport === "soccer") merge(d, eventDeficits(goalScoringEvents(game)));
  const isFinal = game.state === "post" && game.completed;
  return {
    game,
    maxHomeDeficit: d.home,
    maxAwayDeficit: d.away,
    finalAt: prev?.finalAt ?? (isFinal ? now.toISOString() : null),
    finalProcessed: prev?.finalProcessed ?? false,
    summaryAttempts: prev?.summaryAttempts ?? 0,
    emitted: prev?.emitted ?? new Set(),
  };
}

/** Whether a final still needs its moments. First sightings of old finals
 *  (say, after a restart) are stale: the moment has passed. */
export function finalStatus(
  prev: TrackedGame | null,
  t: TrackedGame,
  rules: LeagueRules,
  now: Date,
): "process" | "stale" | "skip" {
  const g = t.game;
  if (!(g.state === "post" && g.completed) || t.finalProcessed) return "skip";
  if (prev) return "process";
  const ageMinutes = (now.getTime() - Date.parse(g.startsAt)) / 60_000;
  return ageMinutes <= rules.maxDurationMinutes + 60 ? "process" : "stale";
}

// ── Before the game ────────────────────────────────────────────────

export function preMoments(g: GameState, now: Date): Moment[] {
  if (g.state !== "pre") return [];
  const startsIn = Date.parse(g.startsAt) - now.getTime();
  if (!(startsIn > 0)) return [];
  const out: Moment[] = [];
  const at = now.toISOString();
  const when = kickoffLabel(g.startsAt);
  const boost = postseasonBoost(g);
  const headline = g.headline ?? "";

  const rivalry = findRivalry(g.league, g.home.team.externalId, g.away.team.externalId);
  if (rivalry && startsIn <= 48 * HOUR_MS) {
    for (const side of SIDES) {
      out.push(
        moment(
          g,
          "rivalry_preview",
          side,
          `${rivalry.name ?? "Rivalry game"}: ${matchup(g)}, ${when}`,
          0.6 + boost,
          { rivalry: rivalry.name ?? null, startsAt: g.startsAt },
          at,
        ),
      );
    }
  }

  const big =
    !NOT_COMPETITIVE.test(headline) && (g.seasonType === 3 || BIG_GAME.test(headline));
  if (big && startsIn <= 24 * HOUR_MS) {
    const title = TITLE_SERIES.test(headline) || TITLE_GAME.test(headline);
    for (const side of SIDES) {
      out.push(
        moment(
          g,
          "big_game_alert",
          side,
          `Big game: ${headline ? `${headline}, ` : ""}${matchup(g)}, ${when}`,
          title ? 0.85 : 0.7,
          { startsAt: g.startsAt },
          at,
        ),
      );
    }
  }

  if (g.seasonType === 2 && startsIn <= 24 * HOUR_MS) {
    for (const side of SIDES) {
      if (/^0(-0)+$/.test(sideOf(g, side).record ?? "")) {
        out.push(
          moment(
            g,
            "season_opener",
            side,
            `${sideOf(g, side).team.shortName} season opener: ${matchup(g)}, ${when}`,
            0.6,
            { startsAt: g.startsAt },
            at,
          ),
        );
      }
    }
  }
  return out;
}

// ── During the game ────────────────────────────────────────────────

function isLate(g: GameState, rules: LeagueRules): boolean {
  if (g.sport === "baseball") return g.period >= rules.lateWindow;
  if (g.sport === "soccer") return (g.minute ?? 0) >= 75;
  if (g.period > rules.regulationPeriods) return true;
  return (
    g.period === rules.regulationPeriods &&
    g.clockSeconds !== null &&
    g.clockSeconds <= rules.lateWindow
  );
}

function isSecondHalf(g: GameState, rules: LeagueRules): boolean {
  if (g.sport === "baseball") return g.period >= 5;
  if (g.sport === "soccer" || g.sport === "hockey") return g.period >= 2;
  return g.period > rules.regulationPeriods / 2;
}

function clutchSpots(g: GameState, rules: LeagueRules): { side: HomeAway; label: string }[] {
  const s = g.situation;
  if (g.sport === "baseball" && s && g.period >= 8) {
    const batting: HomeAway | null =
      g.inningHalf === "top" ? "away" : g.inningHalf === "bottom" ? "home" : null;
    if (!batting) return [];
    const diff = diffFor(g, batting);
    const loaded = s.onFirst && s.onSecond && s.onThird;
    const scoringPosition = s.onSecond || s.onThird;
    const team = sideOf(g, batting).team.shortName;
    if (loaded && diff <= 0 && diff >= -3) {
      return [{ side: batting, label: `bases loaded, ${team} ${diff === 0 ? "tied" : `down ${-diff}`}, ${g.statusDetail}` }];
    }
    if (scoringPosition && diff <= 0 && diff >= -1) {
      const run = diff === 0 ? "go-ahead" : "tying";
      return [{ side: batting, label: `${run} run in scoring position for the ${team}, ${g.statusDetail}` }];
    }
    return [];
  }
  if (
    g.sport === "football" &&
    s?.possessionExternalId &&
    g.period >= rules.regulationPeriods &&
    g.clockSeconds !== null &&
    g.clockSeconds <= 120
  ) {
    const side: HomeAway | null =
      g.home.team.externalId === s.possessionExternalId
        ? "home"
        : g.away.team.externalId === s.possessionExternalId
          ? "away"
          : null;
    if (!side) return [];
    const diff = diffFor(g, side);
    if (diff > 0 || diff < -8) return [];
    const team = sideOf(g, side).team.shortName;
    return [{ side, label: `final drive, ${team} ${diff === 0 ? "tied" : `down ${-diff}`}, ${g.statusDetail}` }];
  }
  if (
    g.sport === "basketball" &&
    g.period >= rules.regulationPeriods &&
    g.clockSeconds !== null &&
    g.clockSeconds <= 30
  ) {
    const diff = g.home.score - g.away.score;
    if (Math.abs(diff) > 3) return [];
    const trailing: HomeAway[] = diff === 0 ? SIDES : [diff < 0 ? "home" : "away"];
    return trailing.map((side) => ({
      side,
      label: `last shot, ${sideOf(g, side).team.shortName} ${diff === 0 ? "tied" : `down ${Math.abs(diff)}`}, ${g.statusDetail}`,
    }));
  }
  return [];
}

export function liveMoments(t: TrackedGame, rules: LeagueRules, now: Date): Moment[] {
  const g = t.game;
  if (g.state !== "in") return [];
  const out: Moment[] = [];
  const at = now.toISOString();
  const boost = postseasonBoost(g);
  const margin = Math.abs(g.home.score - g.away.score);

  if (isLate(g, rules) && margin <= rules.closeMargin) {
    for (const side of SIDES) {
      out.push(
        moment(
          g,
          "close_game",
          side,
          `Close game: ${scoreLine(g, side)}, ${g.statusDetail}`,
          0.55 + (margin === 0 ? 0.05 : 0) + boost,
          { margin },
          at,
        ),
      );
    }
  }

  if (isSecondHalf(g, rules)) {
    for (const side of SIDES) {
      const deficit = side === "home" ? t.maxHomeDeficit : t.maxAwayDeficit;
      const diff = diffFor(g, side);
      if (deficit < rules.comebackDeficit || diff < -rules.oneScore) continue;
      const team = sideOf(g, side).team.shortName;
      const state = diff > 0 ? "lead" : diff === 0 ? "tie it" : `within ${-diff}`;
      out.push(
        moment(
          g,
          "comeback_live",
          side,
          `Comeback on: ${team} ${state} after trailing by ${deficit}, ${g.statusDetail}`,
          0.7 + boost,
          { deficit },
          at,
        ),
      );
    }
  }

  for (const spot of clutchSpots(g, rules)) {
    out.push(
      moment(g, "clutch_moment", spot.side, `Clutch: ${spot.label}`, 0.65 + boost, {}, at),
    );
  }
  return out;
}

// ── After the game ─────────────────────────────────────────────────

interface Finish {
  type: "walkoff_win" | "buzzer_beater" | "late_winner";
  label: string;
  intensity: number;
  detail: Record<string, unknown>;
}

function finishFor(
  g: GameState,
  rules: LeagueRules,
  winner: HomeAway,
  decisive: ScoringEvent | null,
): Finish | null {
  const decisiveDetail = decisive
    ? { decisive: { period: decisive.period, clock: decisive.clock, text: decisive.text } }
    : {};
  switch (g.sport) {
    case "baseball": {
      // Home team won in a bottom half it started tied or behind.
      const h = g.home.linescores;
      const a = g.away.linescores;
      if (winner !== "home" || h.length < rules.regulationPeriods || h.length !== a.length) {
        return null;
      }
      const before = g.home.score - (h[h.length - 1] ?? 0);
      if (before > g.away.score) return null;
      return { type: "walkoff_win", label: "Walk-off win", intensity: 0.9, detail: { inning: h.length } };
    }
    case "hockey": {
      if (g.period <= rules.regulationPeriods) return null;
      const shootout = /\bSO\b/.test(g.statusDetail);
      return {
        type: "walkoff_win",
        label: shootout ? "Shootout winner" : "Overtime winner",
        intensity: shootout ? 0.75 : 0.85,
        detail: { overtime: true, shootout },
      };
    }
    case "football": {
      if (!decisive) {
        return g.period > rules.regulationPeriods
          ? { type: "walkoff_win", label: "Overtime winner", intensity: 0.85, detail: { overtime: true } }
          : null;
      }
      if (decisive.period > rules.regulationPeriods) {
        return { type: "walkoff_win", label: "Overtime winner", intensity: 0.85, detail: { overtime: true, ...decisiveDetail } };
      }
      if (decisive.period === rules.regulationPeriods && decisive.clock <= 10) {
        return { type: "walkoff_win", label: "Walk-off win", intensity: 0.95, detail: decisiveDetail };
      }
      if (decisive.period === rules.regulationPeriods && decisive.clock <= 120) {
        return { type: "late_winner", label: "Late winner", intensity: 0.8, detail: decisiveDetail };
      }
      return null;
    }
    case "basketball": {
      if (!decisive || decisive.period < rules.regulationPeriods) return null;
      if (decisive.clock <= 3) {
        return { type: "buzzer_beater", label: "Buzzer beater", intensity: 0.95, detail: decisiveDetail };
      }
      if (decisive.clock <= 60) {
        return { type: "late_winner", label: "Late winner", intensity: 0.75, detail: decisiveDetail };
      }
      return null;
    }
    case "soccer": {
      if (!decisive || decisive.clock < rules.lateWindow) return null;
      return {
        type: "late_winner",
        label: "Late winner",
        intensity: decisive.clock >= 90 ? 0.9 : 0.8,
        detail: { minute: decisive.clock, ...decisiveDetail },
      };
    }
  }
}

function postseasonMoments(g: GameState, at: string): Moment[] {
  const headline = g.headline ?? "";
  if (NOT_COMPETITIVE.test(headline)) return [];
  const round = headline.split(" - ")[0].trim();

  if (g.series) {
    const { completed, winnerExternalId, summary } = g.series;
    if (!completed || !winnerExternalId) return [];
    const side: HomeAway | null =
      g.home.team.externalId === winnerExternalId
        ? "home"
        : g.away.team.externalId === winnerExternalId
          ? "away"
          : null;
    if (!side) return [];
    const team = sideOf(g, side).team.shortName;
    const name = round || "series";
    return TITLE_SERIES.test(headline)
      ? [moment(g, "title_won", side, `Champions: ${team} win the ${name}`, 1, { round: name, series: summary }, at)]
      : [moment(g, "playoff_advance", side, `Advancing: ${team} win the ${name}`, 0.85, { round: name, series: summary }, at)];
  }

  if (g.seasonType !== 3 || g.home.score === g.away.score) return [];
  const winner: HomeAway = g.home.score > g.away.score ? "home" : "away";
  const team = sideOf(g, winner).team.shortName;
  const title = headline.match(TITLE_GAME);
  if (title) {
    return [moment(g, "title_won", winner, `Champions: ${team} win the ${title[0]}`, 1, { round: round || title[0] }, at)];
  }
  const playoff =
    g.league === "nfl" ||
    /playoff|cfp|men's basketball championship|quarterfinal|semifinal/i.test(headline);
  return playoff
    ? [moment(g, "playoff_advance", winner, `Advancing: ${scoreLine(g, winner)}`, 0.85, { round: round || null }, at)]
    : [];
}

/** Moments for a finished game. `events` is play-by-play scoring when the
 *  feed has it (football, basketball); soccer uses the goals on the game. */
export function finalMoments(
  t: TrackedGame,
  rules: LeagueRules,
  events: ScoringEvent[] | null,
  now: Date,
): Moment[] {
  const g = t.game;
  if (g.state !== "post" || !g.completed) return [];
  const at = t.finalAt ?? now.toISOString();
  const out = postseasonMoments(g, at);
  if (g.home.score === g.away.score) return out;

  const winner: HomeAway = g.home.score > g.away.score ? "home" : "away";
  const loser = other(winner);
  const W = sideOf(g, winner);
  const L = sideOf(g, loser);
  const scoring =
    events && events.length > 0 ? events : g.sport === "soccer" ? goalScoringEvents(g) : null;
  const deficits = { home: t.maxHomeDeficit, away: t.maxAwayDeficit };
  if (scoring) merge(deficits, eventDeficits(scoring));
  const decisive = scoring ? decisiveScore(scoring, winner) : null;
  const finish = finishFor(g, rules, winner, decisive);
  const line = scoreLine(g, winner);
  const boost = postseasonBoost(g);

  if (finish) {
    out.push(moment(g, finish.type, winner, `${finish.label}: ${line}`, finish.intensity + boost, finish.detail, at));
  }

  const overcame = deficits[winner];
  if (overcame >= rules.comebackDeficit) {
    const extra = Math.min(1, (overcame - rules.comebackDeficit) / rules.comebackDeficit);
    out.push(
      moment(
        g,
        "comeback_win",
        winner,
        `Comeback win: ${line} after trailing by ${overcame}`,
        0.6 + 0.2 * extra + boost,
        { deficit: overcame },
        at,
      ),
    );
  }

  const rivalry = findRivalry(g.league, g.home.team.externalId, g.away.team.externalId);
  if (rivalry) {
    out.push(
      moment(
        g,
        "rivalry_win",
        winner,
        `${rivalry.name ?? "Rivalry"} win: ${line}`,
        0.75 + (rivalry.name ? 0.05 : 0) + boost,
        { rivalry: rivalry.name ?? null },
        at,
      ),
    );
  }

  // Any other win in a game that counts. Only when nothing above already
  // marks it, so a walk-off isn't also a plain win. US feeds number the
  // season part (2 regular, 3 postseason); soccer feeds carry a season id.
  const counts = g.sport === "soccer" || g.seasonType === 2 || g.seasonType === 3;
  const competitive = counts && !NOT_COMPETITIVE.test(g.headline ?? "");
  if (competitive && !out.some((m) => m.team.id === W.team.id)) {
    out.push(moment(g, "team_win", winner, `Win: ${line}`, rules.winIntensity + boost, { margin: W.score - L.score }, at));
  }

  const margin = W.score - L.score;
  // A blown lead only hurts if the final stayed close.
  const blownLeadMargin = Math.max(rules.heartbreakMargin, rules.comebackDeficit / 2);
  let heartbreak: { why: string; intensity: number } | null = null;
  if (finish) heartbreak = { why: finish.type, intensity: 0.75 };
  else if (overcame >= rules.comebackDeficit && margin <= blownLeadMargin) {
    heartbreak = { why: "blown_lead", intensity: 0.6 };
  } else if (g.sport !== "soccer" && margin <= rules.heartbreakMargin) {
    heartbreak = { why: "close_loss", intensity: 0.5 };
  }
  if (heartbreak) {
    out.push(
      moment(
        g,
        "heartbreak_loss",
        loser,
        `Heartbreaker: ${L.team.shortName} fall to ${W.team.shortName}, ${W.score}-${L.score}`,
        heartbreak.intensity + boost,
        { why: heartbreak.why, margin },
        at,
      ),
    );
  }
  return out;
}
