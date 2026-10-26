// Who decided a playoff game at the very end: the batter of a walk-off, the
// scorer of an overtime goal, the shooter of a buzzer-beater, the players in
// a last-second or overtime score in football. The hometown job makes their
// towns' moments (engine/hometown.ts). In a title game they join the
// champion's leaders instead, so their town gets the title, once. Pure.
import { nameKey } from "../../lib/places/names";
import { scoringEventsFromSummary } from "../espn/normalize";
import type { EspnSummary } from "../espn/types";
import type { Hero, Heroes } from "./heroes";
import { decisiveScore } from "./rules";
import type { GameState, HomeAway, Moment } from "./types";

export interface Decider {
  /** The deciding play as the feed tells it, for the marketer's eyes only:
   *  "Chourio singled to center, Frelick scored and Yelich scored". */
  play: string;
  /** Who made it, the feed's ids and names: the scorer first, then a
   *  touchdown's passer. */
  athletes: { id: string; name: string }[];
}

/** What a decider is named for among a champion's leaders. */
export const GAME_WINNER = "Game-winner";

/** Walk-offs nobody at the plate earned. */
const NO_CREDIT = /\b(wild pitch|passed ball|balk|error|steals home|stole home)\b/i;

/** "Jr." and "III" come and go between a play's text and the box score. */
const personKey = (name: string) => nameKey(name.replace(/,?\s+(jr|sr|ii|iii|iv|v)\.?$/i, ""));

/** Everyone in a side's box score, by feed id. */
function boxNames(summary: EspnSummary, teamExternalId: string): Map<string, string> {
  const out = new Map<string, string>();
  const box = summary.boxscore?.players?.find((p) => p.team?.id === teamExternalId);
  for (const group of box?.statistics ?? []) {
    for (const a of group.athletes ?? []) {
      if (a.athlete?.id && a.athlete.displayName) out.set(a.athlete.id, a.athlete.displayName);
    }
  }
  return out;
}

/** The players a football scoring play names, the scorer first: "Jaxon
 *  Smith-Njigba 45 Yd pass from Drew Lock (Jason Myers Kick)" is the
 *  receiver, then the passer; "Wil Lutz 23 Yd Field Goal" the kicker. Other
 *  plays name no one here. */
export function namesInScore(text: string): string[] {
  const t = text.replace(/\s*\(.*$/, "").trim();
  const pass = t.match(/^(.+?) \d+ (?:Yd|Yard|Yds) pass from (.+)$/i);
  if (pass) return [pass[1].trim(), pass[2].trim()];
  const one = t.match(/^(.+?) \d+ (?:Yd|Yard|Yds) (?:Run|Rush|Field Goal|(?:Interception|Fumble|Punt|Kickoff|Blocked Punt|Blocked Field Goal|Missed Field Goal) Return)\b/i);
  return one ? [one[1].trim()] : [];
}

const sideOf = (g: GameState, teamExternalId: string): HomeAway | null =>
  g.home.team.externalId === teamExternalId ? "home" : g.away.team.externalId === teamExternalId ? "away" : null;

/** The winner's last scoring play, from baseball's and hockey's play-by-play. */
const lastScore = (summary: EspnSummary, teamExternalId: string) => (summary.plays ?? []).filter((p) => p.scoringPlay && p.team?.id === teamExternalId).at(-1);

/** Who decided a game the winner won at the end, or null when the feed
 *  doesn't say or nobody earned it. */
export function deciderFor(g: GameState, summary: EspnSummary, teamExternalId: string, regulationPeriods: number): Decider | null {
  const side = sideOf(g, teamExternalId);
  if (!side) return null;
  const names = boxNames(summary, teamExternalId);
  const named = (ids: string[], fallback: Map<string, string> = new Map()) =>
    [...new Set(ids)].flatMap((id) => {
      const name = names.get(id) ?? fallback.get(id);
      return name ? [{ id, name }] : [];
    });
  const done = (play: string | undefined, athletes: Decider["athletes"]) => (play && athletes.length ? { play: play.trim(), athletes } : null);

  switch (g.sport) {
    case "baseball": {
      const play = lastScore(summary, teamExternalId);
      if (!play?.text || NO_CREDIT.test(play.text)) return null;
      const batter = play.participants?.find((p) => p.type === "batter")?.athlete?.id;
      return done(play.text, named(batter ? [batter] : []));
    }
    case "hockey": {
      const goal = lastScore(summary, teamExternalId);
      if (!goal || (goal.period?.number ?? 0) <= regulationPeriods) return null;
      const scorer = goal.participants?.find((p) => p.type === "scorer")?.athlete;
      const listed = new Map(scorer?.id && scorer.displayName ? [[scorer.id, scorer.displayName]] : []);
      return done(goal.text, named(scorer?.id ? [scorer.id] : [], listed));
    }
    case "basketball": {
      const decisive = decisiveScore(scoringEventsFromSummary("basketball", summary), side);
      const shooter = decisive?.athleteIds?.[0];
      return done(decisive?.text, named(shooter ? [shooter] : []));
    }
    case "football": {
      const decisive = decisiveScore(scoringEventsFromSummary("football", summary), side);
      if (!decisive) return null;
      const byName = new Map([...names].map(([id, name]) => [personKey(name), id]));
      const ids = namesInScore(decisive.text).flatMap((n) => {
        const id = byName.get(personKey(n));
        return id ? [id] : [];
      });
      return done(decisive.text, named(ids));
    }
    default:
      return null;
  }
}

/** Puts who decided a playoff walk-off or buzzer-beater on its moment, or,
 *  when the same game won a title, among the champion's leaders. Other
 *  games and moments pass through as they are. */
export function addDeciders(moments: Moment[], g: GameState, summary: EspnSummary, regulationPeriods: number): Moment[] {
  if (g.seasonType !== 3) return moments;
  const finish = moments.find((m) => (m.type === "walkoff_win" || m.type === "buzzer_beater") && !m.detail.shootout);
  if (!finish) return moments;
  const decider = deciderFor(g, summary, finish.team.externalId, regulationPeriods);
  if (!decider) return moments;
  const title = moments.find((m) => m.type === "title_won" && m.team.id === finish.team.id);
  return moments.map((m) => {
    if (title) return m === title ? { ...m, detail: { ...m.detail, heroes: withLeaders(m.detail.heroes as Heroes | undefined, decider) } } : m;
    return m === finish ? { ...m, detail: { ...m.detail, decider } } : m;
  });
}

/** The champion's heroes with the decider among the leaders. */
function withLeaders(heroes: Heroes | undefined, decider: Decider): Heroes {
  const leaders: Hero[] = (heroes?.leaders ?? []).map((h) => ({ ...h, why: [...h.why] }));
  for (const a of decider.athletes) {
    const hero = leaders.find((h) => h.id === a.id);
    if (hero) {
      if (!hero.why.includes(GAME_WINNER)) hero.why.unshift(GAME_WINNER);
    } else leaders.unshift({ id: a.id, name: a.name, why: [GAME_WINNER] });
  }
  const played = new Set([...(heroes?.played ?? []), ...decider.athletes.map((a) => a.id)]);
  return { leaders, played: [...played].sort() };
}
