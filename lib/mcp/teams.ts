// Teams by any name people use: "Chargers", "LAC", "Los Angeles Chargers",
// "nfl:24". Moments name teams by feed id ("espn:nfl:24").
import { TEAM_HOMES, type TeamHome } from "../affinity/geo";

export const LEAGUE_ORDER = ["nfl", "nba", "nhl", "mlb", "epl", "ncaaf", "ncaab"];
const PRO = new Set(["nfl", "nba", "nhl", "mlb"]);

export interface TeamRef {
  league: string;
  team: TeamHome;
  /** "nfl:24" */
  key: string;
}

const ref = (league: string, team: TeamHome): TeamRef => ({ league, team, key: `${league}:${team.id}` });

export function teamByKey(key: string): TeamRef | null {
  const [league, id] = key.split(":");
  const team = TEAM_HOMES[league]?.find((t) => t.id === id);
  return team ? ref(league, team) : null;
}

/** "espn:nfl:24" -> the team. */
export function teamFromFeedId(feedId: string | null | undefined): TeamRef | null {
  const m = feedId?.match(/^espn:([a-z0-9.]+):(.+)$/);
  return m ? teamByKey(`${m[1]}:${m[2]}`) : null;
}

export const feedIdOf = (t: TeamRef) => `espn:${t.league}:${t.team.id}`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Short names fans use for team towns, both ways: "LA" is Los Angeles. */
const PLACE_ALIASES: string[][] = [
  ["la", "los angeles"],
  ["ny", "new york"],
  ["nyc", "new york"],
  ["philly", "philadelphia"],
  ["dc", "washington"],
  ["okc", "oklahoma city"],
  ["kc", "kansas city"],
  ["sf", "san francisco"],
  ["vegas", "las vegas"],
  ["nola", "new orleans"],
];

function placeForms(place: string): Set<string> {
  const forms = new Set([norm(place)]);
  for (const pair of PLACE_ALIASES) if (pair.includes(norm(place))) pair.forEach((p) => forms.add(p));
  return forms;
}

/** Every team a name could mean, best matches first. Full names beat
 *  nicknames, which beat abbreviations and cities ("LA" is the Kings'
 *  abbreviation, but it's every Los Angeles team too). */
export function findTeams(query: string, league?: string): TeamRef[] {
  const q = norm(query);
  if (!q) return [];
  const byKey = /^[a-z0-9.]+:\S+$/i.test(query.trim()) ? teamByKey(query.trim().toLowerCase()) : null;
  if (byKey) return [byKey];
  const leagues = league ? [league] : LEAGUE_ORDER;
  const places = placeForms(q);
  const tiers: TeamRef[][] = [[], [], []];
  for (const l of leagues) {
    for (const t of TEAM_HOMES[l] ?? []) {
      if (norm(t.name) === q) tiers[0].push(ref(l, t));
      else if (norm(t.nickname) === q) tiers[1].push(ref(l, t));
      else if (norm(t.abbr) === q || [...placeForms(t.location)].some((f) => places.has(f))) tiers[2].push(ref(l, t));
    }
  }
  return tiers.find((tier) => tier.length) ?? [];
}

/** True when every candidate is the same school (football and basketball). */
export function sameSchool(refs: TeamRef[]): boolean {
  return refs.length > 1 && refs.every((r) => !PRO.has(r.league) && r.league !== "epl" && r.team.id === refs[0].team.id);
}

export const isPro = (league: string) => PRO.has(league);

export type Resolved = { team: TeamRef } | { error: string };

/** The one team a name means: the brand's own territories first, then a
 *  pro team over college teams that share its nickname ("Chargers"), then
 *  a school's football team. Otherwise asks which. */
export function resolveTeam(query: string, opts: { league?: string; prefer?: string[] } = {}): Resolved {
  const found = findTeams(query, opts.league);
  if (!found.length) return { error: `No team matches "${query}"${opts.league ? ` in ${opts.league}` : ""}. Try the full name, like "Los Angeles Chargers".` };
  if (found.length === 1) return { team: found[0] };
  const preferred = found.filter((t) => opts.prefer?.includes(t.key));
  if (preferred.length === 1) return { team: preferred[0] };
  if (sameSchool(found)) return { team: found[0] };
  const pro = found.filter((t) => PRO.has(t.league) || t.league === "epl");
  if (pro.length === 1) return { team: pro[0] };
  const names = found.slice(0, 8).map((t) => `${t.team.name} (${t.key})`);
  return { error: `"${query}" could mean ${names.join(", ")}${found.length > 8 ? ", and more" : ""}. Pass the key or a league.` };
}
