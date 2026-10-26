// Which moments a brand should act on, and how long each one keeps.
import { haversineKm } from "../affinity/geo";
import { HOMETOWN_TYPES, isHometownType } from "../hometown/derive";
import { tourById } from "../tours";
import { momentKind } from "./campaign";

export interface TriggerRule {
  id: string;
  name: string;
  /** Empty: any moment. */
  moment_types: string[];
  /** "nfl:24". Empty: the brand's standout territories, or for hometown
   *  moments any team. */
  team_keys: string[];
  min_intensity: number;
  active: boolean;
  /** Towns, as lib/places keys: the rule is for hometown moments in or
   *  near them. Empty: any town near the brand's customers. */
  place_keys?: string[];
  /** Customers a town needs, estimated. Unset: LOCAL's bar. */
  min_local_customers?: number | null;
}

/** A hometown moment's town, and the brand's customers in its circle. */
export interface LocalFit {
  placeKey: string;
  lat: number;
  lng: number;
  customers: number;
  lift: number | null;
}

export interface QueueMoment {
  type: string;
  intensity: number;
  occurredAt: Date;
  gameStart: Date | null;
  /** "nfl:24", or null for a team Walkoff has no territory for. For a
   *  hometown moment, the champion's. */
  teamKey: string | null;
  /** Hometown moments only. */
  local?: LocalFit | null;
  /** The moment's league or tour: "nfl", "atp". */
  league?: string | null;
}

/** When a town is worth a hometown moment to a brand: enough of its
 *  customers in the town's circle, or fewer that are far more than the
 *  town's share. Customers are estimated from postal areas, which
 *  undercounts a brand whose customers bunch in the town; the lift catches
 *  those. */
export const LOCAL = {
  minCustomers: 50,
  minWithLift: 15,
  minLift: 2.5,
  /** A rule's town takes in moments for towns this close. */
  nearMiles: 10,
  /** Towns per event in a brand's queue; the rest are listed by name. */
  townsPerEvent: 5,
};

export function localEnough(fit: Pick<LocalFit, "customers" | "lift">, rule: Pick<TriggerRule, "min_local_customers">): boolean {
  const min = rule.min_local_customers;
  if (min !== null && min !== undefined) return fit.customers >= min;
  return fit.customers >= LOCAL.minCustomers || (fit.customers >= LOCAL.minWithLift && (fit.lift ?? 0) >= LOCAL.minLift);
}

/** With no rules of its own, a brand acts on its standout teams' wins,
 *  heartbreakers, big games and season moments. Ordinary wins in sports
 *  with a game most days fall under the intensity bar (engine/moments/sports). */
export const DEFAULT_RULE: TriggerRule = {
  id: "default",
  name: "Big moments for your standout teams",
  moment_types: [
    "team_win",
    "walkoff_win",
    "buzzer_beater",
    "late_winner",
    "comeback_win",
    "rivalry_win",
    "heartbreak_loss",
    "rivalry_preview",
    "big_game_alert",
    "season_opener",
    "playoff_clinch",
    "playoff_advance",
    "title_won",
    "great_escape",
    "big_signing",
  ],
  team_keys: [],
  min_intensity: 0.6,
  active: true,
};

/** The default rule, with hometown moments once they're on. */
export const defaultRule = (hometown: boolean): TriggerRule =>
  hometown ? { ...DEFAULT_RULE, moment_types: [...DEFAULT_RULE.moment_types, ...HOMETOWN_TYPES] } : DEFAULT_RULE;

const miles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a, b) / 1.609344;

/** The first active rule a moment matches. A team moment needs one of the
 *  rule's teams (or the brand's standouts). A hometown moment needs its
 *  town near the brand's customers, and near one of the rule's towns when
 *  it names some; towns is where those are. A rule with towns is only for
 *  hometown moments. */
export function matchingRule(
  m: QueueMoment,
  rules: TriggerRule[],
  standouts: string[],
  towns: Map<string, { lat: number; lng: number }> = new Map(),
): TriggerRule | null {
  const hometown = isHometownType(m.type);
  for (const r of rules) {
    if (!r.active) continue;
    if (r.moment_types.length && !r.moment_types.includes(m.type)) continue;
    if (m.intensity < r.min_intensity) continue;
    if (hometown) {
      if (!m.local) continue;
      if (r.team_keys.length && (!m.teamKey || !r.team_keys.includes(m.teamKey))) continue;
      const near = r.place_keys ?? [];
      if (near.length && !near.some((k) => k === m.local!.placeKey || (towns.has(k) && miles(towns.get(k)!, m.local!) <= LOCAL.nearMiles))) continue;
      if (!localEnough(m.local, r)) continue;
      return r;
    }
    if (r.place_keys?.length) continue;
    const teams = r.team_keys.length ? r.team_keys : standouts;
    if (!m.teamKey || !teams.includes(m.teamKey)) continue;
    return r;
  }
  return null;
}

export interface MomentWindow {
  status: "open" | "closing" | "closed";
  closes_at: string | null;
  note: string;
}

const HOUR = 3_600_000;

/** How long a moment is worth acting on, in hours: a result for about a
 *  day, a season moment for three, a live one only for a few hours. A
 *  pre-game moment lasts until kickoff, or a day when the start isn't known. */
export const WINDOW_HOURS = { result: 30, season: 72, live: 3, pregame: 24 } as const;

export function momentWindow(m: QueueMoment, now: Date): MomentWindow {
  const kind = momentKind(m.type);
  const start = m.occurredAt.getTime();
  const closes =
    kind === "pregame"
      ? (m.gameStart?.getTime() ?? start + WINDOW_HOURS.pregame * HOUR)
      : start + (kind === "live" ? WINDOW_HOURS.live : kind === "season" ? WINDOW_HOURS.season : WINDOW_HOURS.result) * HOUR;
  const left = closes - now.getTime();
  const closesAt = new Date(closes).toISOString();
  // A contender's window closes when the final round, or the final, starts.
  const what = m.type !== "hometown_contender" ? "The game" : tourById(m.league ?? "")?.sport === "tennis" ? "The final" : "The final round";
  if (left <= 0) return { status: "closed", closes_at: closesAt, note: kind === "pregame" ? `${what} has started.` : "The window has passed." };
  const hours = left / HOUR;
  const leftText = hours < 1 ? `${Math.max(1, Math.round(hours * 60))} minutes` : `${Math.round(hours)} hours`;
  const closing = left < 0.25 * Math.max(closes - start, HOUR);
  return {
    status: closing ? "closing" : "open",
    closes_at: closesAt,
    note: kind === "pregame" ? `${what} starts in ${leftText}.` : `About ${leftText} left to act.`,
  };
}
