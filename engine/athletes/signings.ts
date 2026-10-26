// Big signings: a star who joins a team, by trade, signing or transfer, is
// big news for the new team's fans. The roster sync notices the move
// (sync.ts) once 010_player_moments.sql has run; this decides who counts as
// a star and makes the big_signing moment. Fame is how many Wikimedia sites
// have a page about a player, from Wikidata, next to the rest of their
// league: an average Premier League player has more than the NFL's best
// known. See engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";

const HOUR = 3_600_000;

export const FAME = {
  /** Pages a player needs at all, so a league Wikidata knows little about
   *  yet can't make a star of anyone. */
  min: 15,
  /** One of the league's best known: fewer than this many have more pages. */
  top: 50,
  /** The best known few count for more. */
  topFew: 10,
  intensity: 0.75,
  intensityTopFew: 0.85,
  /** A move this recent still makes a moment. */
  window: 72 * HOUR,
};

/** An athlete the sync saw join a team, as athletes stores them. */
export interface Mover {
  id: string;
  league: string;
  display_name: string;
  position: string | null;
  team_id: string;
  previous_team_id: string | null;
  joined_at: string;
  sitelinks: number;
}

/** How many players in the athlete's league have more pages: 0 is the
 *  league's best known. */
export async function fameRank(db: SupabaseClient, m: Pick<Mover, "league" | "sitelinks">): Promise<number> {
  const { count, error } = await db.from("athletes").select("id", { count: "exact", head: true }).eq("league", m.league).gt("sitelinks", m.sitelinks);
  if (error) throw error;
  return count ?? 0;
}

/** The moment for the new team's fans, as moments stores it. Names are for
 *  the marketer: campaign copy never names the player. */
export function signingRow(m: Mover, rank: number, teams: Map<string, string>) {
  const team = teams.get(m.team_id) ?? m.team_id;
  const from = m.previous_team_id ? (teams.get(m.previous_team_id) ?? null) : null;
  const who = m.position ? `${m.display_name} (${m.position})` : m.display_name;
  return {
    dedupe_key: `big_signing:${m.id}:${m.team_id}`,
    type: "big_signing",
    category: "sports",
    phase: "season",
    league: m.league,
    game_id: null,
    team_id: m.team_id,
    opponent_team_id: null,
    athlete_id: m.id,
    headline: `Big signing: ${who} joins the ${team}${from ? ` from the ${from}` : ""}`,
    intensity: rank < FAME.topFew ? FAME.intensityTopFew : FAME.intensity,
    detail: {
      athlete: { id: m.id, name: m.display_name, position: m.position },
      from: m.previous_team_id ? { id: m.previous_team_id, name: from } : null,
      fame: { sitelinks: m.sitelinks, rank: rank + 1 },
    },
    occurred_at: m.joined_at,
  };
}
