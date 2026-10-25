// ESPN team rosters: who plays where, and where ESPN says they were born.
// Kept apart from FeedClient (espn/client.ts), which the pollers and their
// test fakes use.
import { getJson } from "../espn/client";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

export interface RosterPlayer {
  externalId: string;
  displayName: string;
  position: string | null;
  jersey: string | null;
  /** On the roster but not playing: injured reserve, practice squad,
   *  suspended. */
  reserve: boolean;
  college: string | null;
  /** As ESPN has it, or null when it has none. */
  birthPlace: { city: string; state: string; country: string } | null;
}

export interface AthleteFeed {
  roster(feedPath: string, teamId: string): Promise<RosterPlayer[]>;
}

interface EspnPlayer {
  id?: string;
  displayName?: string;
  jersey?: string;
  position?: { abbreviation?: string };
  status?: { type?: string };
  college?: { name?: string } | null;
  birthPlace?: { city?: string; state?: string; country?: string };
}

/** NFL and college football group players this way; reserves are in the
 *  last three. Other leagues group by position, or not at all. */
const RESERVE_GROUPS = new Set(["injuredReserveOrOut", "practiceSquad", "suspended"]);

const text = (s: string | undefined) => s?.trim() ?? "";

function player(p: EspnPlayer, group: string | null): RosterPlayer | null {
  if (!p.id || !p.displayName) return null;
  const city = text(p.birthPlace?.city);
  return {
    externalId: String(p.id),
    displayName: p.displayName.trim(),
    position: p.position?.abbreviation || null,
    jersey: p.jersey || null,
    reserve: (group !== null && RESERVE_GROUPS.has(group)) || p.status?.type === "practice-squad",
    college: p.college?.name || null,
    birthPlace: city ? { city, state: text(p.birthPlace?.state), country: text(p.birthPlace?.country) } : null,
  };
}

/** A roster as one list, whether ESPN grouped it or not. */
export function parseRoster(json: unknown): RosterPlayer[] {
  const athletes = (json as { athletes?: unknown[] })?.athletes ?? [];
  const out: RosterPlayer[] = [];
  for (const a of athletes) {
    const group = a as { position?: string; items?: EspnPlayer[] };
    if (Array.isArray(group.items)) {
      for (const p of group.items) {
        const r = player(p, group.position ?? null);
        if (r) out.push(r);
      }
    } else {
      const r = player(a as EspnPlayer, null);
      if (r) out.push(r);
    }
  }
  return out;
}

/** ESPN's birthplace as one line, the way athlete_places keeps it: "Capistrano
 *  Beach, CA, USA". */
export function birthPlaceText(b: NonNullable<RosterPlayer["birthPlace"]>): string {
  return [b.city, b.state, b.country].filter(Boolean).join(", ");
}

export function createAthleteFeed(options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): AthleteFeed {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async roster(feedPath, teamId) {
      return parseRoster(await getJson(`${BASE}/${feedPath}/teams/${encodeURIComponent(teamId)}/roster`, timeoutMs, fetchImpl));
    },
  };
}
