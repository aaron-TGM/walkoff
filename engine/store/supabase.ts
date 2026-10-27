import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchema } from "../../lib/supabase";
import type { GameStateName, Moment, TeamRef, TrackedGame } from "../moments/types";
import type { Heartbeat, Store, StoredGame } from "./types";

// Tables are created by supabase/003_moment_engine.sql.

export function teamRow(t: TeamRef) {
  return {
    id: t.id,
    league: t.league,
    external_id: t.externalId,
    abbreviation: t.abbreviation || null,
    display_name: t.displayName,
    short_name: t.shortName || null,
    location: t.location || null,
    color: t.color,
    alternate_color: t.alternateColor,
    updated_at: new Date().toISOString(),
  };
}

/** `withFinal` is false until supabase/013_final_processed.sql has run. */
export function gameRow(t: TrackedGame, withFinal = true) {
  const g = t.game;
  return {
    id: g.id,
    league: g.league,
    external_id: g.externalId,
    name: g.name,
    starts_at: g.startsAt,
    state: g.state,
    completed: g.completed,
    status_detail: g.statusDetail || null,
    period: g.period,
    season_type: g.seasonType,
    headline: g.headline,
    home_team_id: g.home.team.id,
    away_team_id: g.away.team.id,
    home_score: g.home.score,
    away_score: g.away.score,
    max_home_deficit: t.maxHomeDeficit,
    max_away_deficit: t.maxAwayDeficit,
    final_at: t.finalAt,
    ...(withFinal && { final_processed: t.finalProcessed }),
    updated_at: new Date().toISOString(),
  };
}

export function momentRow(m: Moment) {
  return {
    dedupe_key: m.dedupeKey,
    type: m.type,
    category: m.category,
    phase: m.phase,
    league: m.league,
    game_id: m.gameId,
    team_id: m.team.id,
    opponent_team_id: m.opponent?.id ?? null,
    headline: m.headline,
    intensity: m.intensity,
    detail: m.detail,
    occurred_at: m.occurredAt,
  };
}

/** A server-side client with the service role key, which never signs in. */
export function serviceClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const GAME_COLUMNS = "id, state, completed, max_home_deficit, max_away_deficit, final_at";

export function createSupabaseStore(db: SupabaseClient): Store {
  // supabase/013_final_processed.sql adds games.final_processed. Until it
  // has run, games are saved and restored without it, as before.
  let withFinal = true;

  return {
    kind: "supabase",

    async loadRecentGames(league: string, since: Date): Promise<StoredGame[]> {
      const recent = (columns: string) =>
        db.from("games").select(columns).eq("league", league).gte("updated_at", since.toISOString());
      let { data, error } = await recent(withFinal ? `${GAME_COLUMNS}, final_processed` : GAME_COLUMNS);
      if (withFinal && isMissingSchema(error)) {
        withFinal = false;
        ({ data, error } = await recent(GAME_COLUMNS));
      }
      if (error) throw error;
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        state: r.state as GameStateName,
        completed: Boolean(r.completed),
        maxHomeDeficit: Number(r.max_home_deficit) || 0,
        maxAwayDeficit: Number(r.max_away_deficit) || 0,
        finalAt: (r.final_at as string | null) ?? null,
        finalProcessed: typeof r.final_processed === "boolean" ? r.final_processed : null,
      }));
    },

    async saveTeams(teams: TeamRef[]): Promise<void> {
      if (!teams.length) return;
      const { error } = await db.from("teams").upsert(teams.map(teamRow), { onConflict: "id" });
      if (error) throw error;
    },

    async saveGames(games: TrackedGame[]): Promise<void> {
      if (!games.length) return;
      const save = () => db.from("games").upsert(games.map((t) => gameRow(t, withFinal)), { onConflict: "id" });
      let { error } = await save();
      if (withFinal && isMissingSchema(error)) {
        withFinal = false;
        ({ error } = await save());
      }
      if (error) throw error;
    },

    async saveMoments(moments: Moment[]): Promise<Moment[]> {
      if (!moments.length) return [];
      // ON CONFLICT DO NOTHING: the returned rows are only the new ones.
      const { data, error } = await db
        .from("moments")
        .upsert(moments.map(momentRow), { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("dedupe_key");
      if (error) throw error;
      const inserted = new Set((data ?? []).map((r) => r.dedupe_key as string));
      return moments.filter((m) => inserted.has(m.dedupeKey));
    },

    async saveHeartbeat(hb: Heartbeat): Promise<void> {
      const row: Record<string, unknown> = {
        league: hb.league,
        last_poll_at: hb.at,
        latency_ms: hb.latencyMs,
        games: hb.games,
        live_games: hb.liveGames,
        consecutive_failures: hb.consecutiveFailures,
        updated_at: hb.at,
      };
      if (hb.ok) row.last_ok_at = hb.at;
      else {
        row.last_error_at = hb.at;
        row.last_error = hb.error;
      }
      const { error } = await db.from("engine_heartbeats").upsert(row, { onConflict: "league" });
      if (error) throw error;
    },
  };
}
