import { DEFAULT_MODEL, EFFORTS, type Effort } from "../lib/affinity/claude-tagger";
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
  /** Claude tags each brand's new products (engine/tagger.ts). On when
   *  there's an Anthropic API key, unless TAG_CATALOGS is 0. */
  tagCatalogs: boolean;
  tagModel: string;
  tagEffort: Effort;
  /** Rosters, where athletes are from and the curated hometowns
   *  (engine/athletes). On unless ATHLETES is 0. */
  athletes: boolean;
  /** High schools and birthplaces from Wikidata, part of that. On unless
   *  WIKIDATA is 0. */
  wikidata: boolean;
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

  // The same model and effort settings as scripts/tag-catalog.ts.
  const tagEffort = (env.WALKOFF_TAG_EFFORT || "medium") as Effort;
  if (!EFFORTS.includes(tagEffort)) {
    throw new Error(`Unknown WALKOFF_TAG_EFFORT ${tagEffort}. Known: ${EFFORTS.join(", ")}`);
  }

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
    tagCatalogs: !!env.ANTHROPIC_API_KEY && env.TAG_CATALOGS !== "0",
    tagModel: env.WALKOFF_TAG_MODEL || DEFAULT_MODEL,
    tagEffort,
    athletes: env.ATHLETES !== "0",
    wikidata: env.WIKIDATA !== "0",
  };
}
