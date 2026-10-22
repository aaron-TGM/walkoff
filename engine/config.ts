import { LEAGUES } from "../lib/leagues";
import { LEAGUE_RULES } from "./moments/sports";

export interface EngineConfig {
  leagues: string[];
  supabaseUrl: string | null;
  supabaseKey: string | null;
  /** Keep everything in memory and only log moments. */
  dryRun: boolean;
  /** Poll every league once, then exit. */
  once: boolean;
  port: number;
  livePollMs: number;
  soonPollMs: number;
  idlePollMs: number;
  /** How often date-based leagues also fetch the next two days. */
  lookaheadMs: number;
}

function seconds(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return (Number.isFinite(n) && n > 0 ? n : fallback) * 1000;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): EngineConfig {
  const known = LEAGUES.map((l) => l.id).filter((id) => id in LEAGUE_RULES);
  const requested = env.LEAGUES?.split(",").map((s) => s.trim()).filter(Boolean);
  const leagues = requested?.length ? requested : known;
  const unknown = leagues.filter((id) => !known.includes(id));
  if (unknown.length) {
    throw new Error(`Unknown league(s) in LEAGUES: ${unknown.join(", ")}. Known: ${known.join(", ")}`);
  }

  const supabaseUrl = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  return {
    leagues,
    supabaseUrl,
    supabaseKey,
    dryRun: env.DRY_RUN === "1" || !supabaseUrl || !supabaseKey,
    once: env.ONCE === "1",
    port: Number(env.PORT) || 8080,
    livePollMs: seconds(env.LIVE_POLL_SECONDS, 15),
    soonPollMs: seconds(env.SOON_POLL_SECONDS, 60),
    idlePollMs: seconds(env.IDLE_POLL_SECONDS, 300),
    lookaheadMs: seconds(env.LOOKAHEAD_SECONDS, 1800),
  };
}
