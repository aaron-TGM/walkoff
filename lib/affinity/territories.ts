// Fan territories: for each postal area, how its sports fans split across
// a league's teams. A gravity model shaped by what's commonly recognized
// about fan bases (scripts/lib/team-overrides.ts):
//   - fans follow nearby teams, falling off with distance squared
//   - shared markets split by fan-base size (Yankees over Mets)
//   - national brands reach further (Cowboys, Packers, Manchester United)
//   - regional teams count as local across their region (Patriots in Maine)
//   - college fans favor in-state schools
import { haversineKm, POSTAL_AREAS, TEAM_HOMES, type Country, type PostalArea, type TeamHome } from "./geo";

export const LEAGUE_COUNTRIES: Record<string, Country[]> = {
  nfl: ["US"],
  nba: ["US", "CA"],
  nhl: ["US", "CA"],
  mlb: ["US", "CA"],
  ncaaf: ["US"],
  ncaab: ["US"],
  epl: ["GB"],
};

interface Model {
  /** How fast fandom falls off with distance. */
  gamma: number;
  /** Distances shorter than this count as this, so home areas don't blow up. */
  minKm: number;
  /** Within this distance it's a local contest and reach doesn't apply. */
  localKm: number;
  /** Multiplier for teams in the area's own state or region. */
  regionBoost: number;
}

const MODELS: Record<string, Model> = {
  pro: { gamma: 2, minKm: 15, localKm: 60, regionBoost: 3 },
  college: { gamma: 1.5, minKm: 25, localKm: 40, regionBoost: 4 },
  soccer: { gamma: 2, minKm: 3, localKm: 15, regionBoost: 1 },
};

/** Distance as fandom feels it: a national brand's far-away fans count as
 *  closer, but next door it's a fair fight (Spurs still own Tottenham). */
function effectiveKm(km: number, reach: number, model: Model): number {
  const far = km <= model.localKm ? km : model.localKm + (km - model.localKm) / reach;
  return Math.max(far, model.minKm);
}

function modelFor(league: string): Model {
  if (league === "ncaaf" || league === "ncaab") return MODELS.college;
  if (league === "epl") return MODELS.soccer;
  return MODELS.pro;
}

export interface TeamShare {
  team: TeamHome;
  /** Share of the area's fans of this league, 0 to 1. */
  share: number;
}

/** Teams below this share in an area are dropped as noise. */
const MIN_SHARE = 0.05;
const MAX_TEAMS = 3;

export function sharesForArea(league: string, area: PostalArea): TeamShare[] {
  if (!LEAGUE_COUNTRIES[league]?.includes(area.country)) return [];
  const model = modelFor(league);
  const scored = (TEAM_HOMES[league] ?? []).map((team) => {
    const km = effectiveKm(haversineKm(area, team), team.reach, model);
    const local = team.region === area.region || team.regions.includes(area.region);
    return { team, score: team.weight * (local ? model.regionBoost : 1) * km ** -model.gamma };
  });
  const total = scored.reduce((s, x) => s + x.score, 0);
  if (!total) return [];
  const kept = scored
    .map((x) => ({ team: x.team, share: x.score / total }))
    .filter((x) => x.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_TEAMS);
  const keptTotal = kept.reduce((s, x) => s + x.share, 0);
  return kept.map((x) => ({ team: x.team, share: x.share / keptTotal }));
}

export interface LeagueTerritory {
  league: string;
  /** Postal area key -> fan shares. */
  byArea: Map<string, TeamShare[]>;
  /** Team id -> share of the league countries' population in its territory. */
  populationShare: Map<string, number>;
  population: number;
}

const cache = new Map<string, LeagueTerritory>();

/** Territories for every postal area in a league's countries. Computed once
 *  per process (a few milliseconds per league). */
export function territory(league: string): LeagueTerritory {
  const hit = cache.get(league);
  if (hit) return hit;
  const countries = LEAGUE_COUNTRIES[league] ?? [];
  const byArea = new Map<string, TeamShare[]>();
  const teamPop = new Map<string, number>();
  let population = 0;
  for (const area of POSTAL_AREAS) {
    if (!countries.includes(area.country)) continue;
    const shares = sharesForArea(league, area);
    byArea.set(area.key, shares);
    population += area.population;
    for (const s of shares) {
      teamPop.set(s.team.id, (teamPop.get(s.team.id) ?? 0) + area.population * s.share);
    }
  }
  const populationShare = new Map([...teamPop].map(([id, p]) => [id, p / population]));
  const t = { league, byArea, populationShare, population };
  cache.set(league, t);
  return t;
}
