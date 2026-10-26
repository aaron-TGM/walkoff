// Saving hometown moments. They're moments like any other, with the town
// and the athlete in the columns supabase/009_athletes.sql adds.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HometownMoment } from "./derive";

function momentRow(m: HometownMoment) {
  return {
    dedupe_key: m.dedupeKey,
    type: m.type,
    category: "sports",
    phase: m.phase,
    league: m.league,
    game_id: m.gameId,
    team_id: m.teamId,
    opponent_team_id: m.opponentTeamId,
    athlete_id: m.athleteId,
    place_key: m.placeKey,
    headline: m.headline,
    intensity: m.intensity,
    detail: m.detail,
    occurred_at: m.occurredAt,
  };
}

/** Saves hometown moments, skipping any already stored (a town keeps the
 *  moment it got first). Returns only the new ones. */
export async function saveHometownMoments(db: SupabaseClient, moments: HometownMoment[]): Promise<HometownMoment[]> {
  if (!moments.length) return [];
  const { data, error } = await db
    .from("moments")
    .upsert(moments.map(momentRow), { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("dedupe_key");
  if (error) throw error;
  const inserted = new Set(((data ?? []) as { dedupe_key: string }[]).map((r) => r.dedupe_key));
  return moments.filter((m) => inserted.has(m.dedupeKey));
}
