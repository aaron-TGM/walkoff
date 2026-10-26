// The players behind a title: who led the champion in the deciding game,
// and everyone with a line in its box score. The hometown job reads these
// from the title moment to rank each player's part (engine/hometown.ts).
import type { EspnSummary } from "../espn/types";
import type { Moment, Sport } from "./types";

export interface Hero {
  /** The feed's athlete id: "3912547". */
  id: string;
  name: string;
  /** What they led or were named for: "Passing Yards", "Winning Pitcher". */
  why: string[];
}

export interface Heroes {
  leaders: Hero[];
  /** Feed ids of everyone with a line in the box score, leaders included. */
  played: string[];
}

/** Featured athletes named for the other side's loss. */
const LOSING = /^losing/i;

/** The champion's heroes, or null when the summary has no box score for it. */
export function heroesFor(sport: Sport, summary: EspnSummary, teamExternalId: string): Heroes | null {
  const box = summary.boxscore?.players?.find((p) => p.team?.id === teamExternalId);
  if (!box) return null;
  const played = new Set<string>();
  const leaders = new Map<string, Hero>();
  const lead = (id: string | undefined, name: string | undefined, why: string | undefined) => {
    if (!id || !why) return;
    const hero = leaders.get(id) ?? { id, name: name ?? "", why: [] };
    if (!hero.why.includes(why)) hero.why.push(why);
    leaders.set(id, hero);
  };

  for (const group of box.statistics ?? []) {
    // Baseball has no leaders: a home run in the deciding game counts. Only
    // at the plate: the pitching lines count the ones given up.
    const homeRuns = sport === "baseball" && group.type === "batting" ? (group.keys ?? []).indexOf("homeRuns") : -1;
    for (const a of group.athletes ?? []) {
      const id = a.athlete?.id;
      if (!id || a.didNotPlay || !a.stats?.length) continue;
      played.add(id);
      if (homeRuns >= 0 && Number(a.stats[homeRuns]) > 0) lead(id, a.athlete?.displayName, "Home Run");
    }
  }
  for (const category of summary.leaders?.find((t) => t.team?.id === teamExternalId)?.leaders ?? []) {
    const top = category.leaders?.[0];
    lead(top?.athlete?.id, top?.athlete?.displayName, category.displayName ?? category.name);
  }
  for (const f of summary.header?.competitions?.[0]?.status?.featuredAthletes ?? []) {
    if (f.team?.id !== teamExternalId || LOSING.test(f.name ?? "")) continue;
    lead(f.athlete?.id, f.athlete?.displayName, f.displayName ?? f.name);
  }
  for (const id of leaders.keys()) played.add(id);
  if (!played.size) return null;
  return { leaders: [...leaders.values()], played: [...played].sort() };
}

/** Adds the champion's heroes to its title moment; other moments pass
 *  through as they are. */
export function addHeroes(moments: Moment[], sport: Sport, summary: EspnSummary): Moment[] {
  return moments.map((m) => {
    if (m.type !== "title_won") return m;
    const heroes = heroesFor(sport, summary, m.team.externalId);
    return heroes ? { ...m, detail: { ...m.detail, heroes } } : m;
  });
}
