// Hometown moments: when athletes win something, each town they're from
// gets a moment of its own, for brands with customers there. One moment per
// event per town, however many of the town's athletes took part; the most
// prominent of them is the moment's athlete. Pure: the engine's hometown
// job (engine/hometown.ts) and the create_moment tool load the inputs and
// save what comes back.
import type { Athlete, AthleteResult, Home, ResultKind, ResultRole } from "../athletes";
import type { Place, TownCircle } from "../places";

export const HOMETOWN_TYPES = ["hometown_title", "hometown_win", "hometown_contender"] as const;
export type HometownType = (typeof HOMETOWN_TYPES)[number];

export const isHometownType = (type: string): type is HometownType => (HOMETOWN_TYPES as readonly string[]).includes(type);

const TYPE_FOR: Record<ResultKind, HometownType> = {
  title: "hometown_title",
  win: "hometown_win",
  lead: "hometown_contender",
};

/** What each part in a team's title counts for. */
export const ROLE_INTENSITY: Record<ResultRole, number> = {
  leader: 0.95,
  played: 0.85,
  roster: 0.75,
  reserve: 0.7,
};

/** What an athlete did, for the marketer: the order of prominence. */
const ROLE_RANK: Record<ResultRole, number> = { leader: 0, played: 1, roster: 2, reserve: 3 };

/** The event behind the results: a title game, a tournament. */
export interface HometownEvent {
  /** "espn:nfl:401772988". */
  key: string;
  /** "Super Bowl LX", for the marketer's eyes only. */
  name: string;
  kind: ResultKind;
  /** lib/leagues id or tour: "nfl", "pga". */
  league: string;
  gameId: string | null;
  /** The champion, for a team's title. */
  teamId: string | null;
  teamName: string | null;
  opponentTeamId: string | null;
  occurredAt: string;
  /** Contenders: when the final round starts, which ends their window. */
  startsAt?: string | null;
}

/** An athlete with a result in the event, and their homes. */
export interface Local {
  athlete: Athlete;
  result: AthleteResult;
  /** momentHomes(): sure enough for a moment. */
  homes: Home[];
  /** What they led in the event: "Passing Yards". */
  led?: string[];
}

/** A town's place and circle, worked out by the caller (lib/places). */
export interface Town {
  place: Place;
  /** "San Clemente, CA". */
  label: string;
  circle: TownCircle;
}

/** A hometown moment as moments stores it (supabase/009 adds athlete_id
 *  and place_key). */
export interface HometownMoment {
  dedupeKey: string;
  type: HometownType;
  phase: "season" | "before";
  league: string;
  gameId: string | null;
  teamId: string | null;
  opponentTeamId: string | null;
  athleteId: string;
  placeKey: string;
  headline: string;
  intensity: number;
  detail: HometownDetail;
  occurredAt: string;
}

export interface HometownDetail {
  town: {
    key: string;
    name: string;
    label: string;
    region: string;
    country: string;
    /** Where Klaviyo centers the circle. */
    ref: string;
    radius_miles: number;
    population: number;
    big_city: boolean;
  };
  event: { key: string; name: string; kind: ResultKind };
  team: { id: string; name: string } | null;
  /** Contenders: the final round's first tee time. */
  startsAt?: string;
  /** Everyone from the town, the most prominent first. Names are for the
   *  marketer, never for campaign copy. */
  athletes: {
    id: string;
    name: string;
    position: string | null;
    role: ResultRole;
    led?: string[];
    sure: number;
    from: { kind: string; source: string; raw: string }[];
  }[];
}

/** Homes in a big city count only when a person set them: an operator, or
 *  the curated file. Elsewhere a birthplace is too thin a link to a city
 *  of millions. */
const handSet = (h: Home) => h.from[0]?.source === "operator" || h.from[0]?.source === "curated";

type Entry = { local: Local; home: Home };

/** The most prominent first: what they did, then how sure the home is. */
const ord = (x: Entry, y: Entry) =>
  ROLE_RANK[x.local.result.role] - ROLE_RANK[y.local.result.role] ||
  y.local.result.intensity - x.local.result.intensity ||
  y.home.confidence - x.home.confidence ||
  x.local.athlete.displayName.localeCompare(y.local.athlete.displayName);

const who = (a: Athlete) => (a.position ? `${a.displayName} (${a.position})` : a.displayName);

/** "Super Bowl LX" reads without "the", "the World Series" with it. */
const theEvent = (name: string) => (/^(the|super bowl)\b/i.test(name) ? name : `the ${name}`);

function headline(event: HometownEvent, people: Athlete[], town: string): string {
  const first = who(people[0]);
  const names = people.length === 1 ? first : people.length === 2 ? `${first} and ${who(people[1])}` : `${first} and ${people.length - 1} more`;
  const what = theEvent(event.name);
  if (event.kind === "title") {
    const team = event.teamName ? ` with the ${event.teamName}` : "";
    return `Hometown ${people.length === 1 ? "champion" : "champions"}: ${names} won ${what}${team} · ${town}`;
  }
  if (event.kind === "win") return `Hometown win: ${names} won ${what} · ${town}`;
  return `Hometown contender: ${names} ${people.length === 1 ? "leads" : "lead"} ${what} going into the final round · ${town}`;
}

/** One moment per town the event's athletes are from. towns has a Town
 *  for each home's placeKey; a home without one is skipped. */
export function deriveHometownMoments(event: HometownEvent, locals: Local[], towns: Map<string, Town>): HometownMoment[] {
  const byTown = new Map<string, Entry[]>();
  for (const local of locals) {
    for (const home of local.homes) {
      const town = towns.get(home.placeKey);
      if (!town || (town.circle.bigCity && !handSet(home))) continue;
      byTown.set(home.placeKey, [...(byTown.get(home.placeKey) ?? []), { local, home }]);
    }
  }
  const type = TYPE_FOR[event.kind];
  const out: HometownMoment[] = [];
  for (const [key, entries] of byTown) {
    const town = towns.get(key)!;
    const ranked = [...entries].sort(ord);
    out.push({
      dedupeKey: `${type}:${event.key}:${key}`,
      type,
      phase: event.kind === "lead" ? "before" : "season",
      league: event.league,
      gameId: event.gameId,
      teamId: event.teamId,
      opponentTeamId: event.opponentTeamId,
      athleteId: ranked[0].local.athlete.id,
      placeKey: key,
      headline: headline(event, ranked.map((e) => e.local.athlete), town.label),
      intensity: Math.max(...ranked.map((e) => e.local.result.intensity)),
      detail: {
        town: {
          key,
          name: town.place.name,
          label: town.label,
          region: town.place.region,
          country: town.place.country,
          ref: town.circle.ref,
          radius_miles: town.circle.radiusMiles,
          population: town.circle.population,
          big_city: town.circle.bigCity,
        },
        event: { key: event.key, name: event.name, kind: event.kind },
        team: event.teamId && event.teamName ? { id: event.teamId, name: event.teamName } : null,
        ...(event.startsAt ? { startsAt: event.startsAt } : {}),
        athletes: ranked.map(({ local: { athlete: a, result: r, led }, home: h }) => ({
          id: a.id,
          name: a.displayName,
          position: a.position,
          role: r.role,
          ...(led?.length ? { led } : {}),
          sure: h.confidence,
          from: h.from,
        })),
      },
      occurredAt: event.occurredAt,
    });
  }
  return out.sort((a, b) => b.intensity - a.intensity || a.placeKey.localeCompare(b.placeKey));
}
