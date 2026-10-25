// Walkoff moment engine: polls live sports data, detects moments and saves
// them to Supabase. It also has Claude tag each brand's new products
// (tagger.ts), keeps rosters and where athletes are from
// (athletes/sync.ts), and makes a moment for each town a champion's
// players are from (hometown.ts). See engine/README.md.
import { claudeSend, colorTask, productTask } from "../lib/affinity/claude-tagger";
import { LEAGUES } from "../lib/leagues";
import { createAthleteFeed } from "./athletes/feed";
import { AthleteSync } from "./athletes/sync";
import { createWikidataClient } from "./athletes/wikidata";
import { loadConfig } from "./config";
import { createEspnClient } from "./espn/client";
import { isHealthy, startHealthServer } from "./health";
import { HometownJob } from "./hometown";
import { errorMessage, log } from "./log";
import { rulesFor } from "./moments/sports";
import { LeaguePoller } from "./poller";
import { MemoryStore } from "./store/memory";
import { createSupabaseStore, serviceClient } from "./store/supabase";
import type { Store } from "./store/types";
import { CatalogTagger } from "./tagger";

async function main(): Promise<void> {
  const config = loadConfig();
  const store: Store =
    config.dryRun || !config.supabaseUrl || !config.supabaseKey
      ? new MemoryStore()
      : createSupabaseStore(config.supabaseUrl, config.supabaseKey);
  if (store.kind === "memory") {
    log("WARNING", "Dry run: moments are logged, not saved. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save them.");
  }

  const client = createEspnClient();
  const pollers = config.leagues.map((id) => {
    const league = LEAGUES.find((l) => l.id === id);
    if (!league) throw new Error(`Unknown league ${id}`);
    return new LeaguePoller(league, rulesFor(id), { client, store, config });
  });

  const service =
    store.kind === "supabase" && !config.once && config.supabaseUrl && config.supabaseKey
      ? serviceClient(config.supabaseUrl, config.supabaseKey)
      : null;

  // Claude's pass over each brand's new products, when it can save them.
  const claude = { model: config.tagModel, effort: config.tagEffort };
  const tagger =
    config.tagCatalogs && service
      ? new CatalogTagger(service, {
          send: { products: claudeSend(productTask(), claude), colors: claudeSend(colorTask(), claude) },
          model: config.tagModel,
        })
      : null;
  if (service && !tagger) {
    log("WARNING", "Catalog tagging is off (no ANTHROPIC_API_KEY, or TAG_CATALOGS=0): new products keep their rule-based tags.");
  }

  // Rosters and where athletes are from, for hometown moments.
  const athletes =
    config.athletes && service
      ? new AthleteSync(service, createAthleteFeed(), {
          leagues: config.leagues,
          wikidata: config.wikidata ? createWikidataClient() : null,
        })
      : null;
  // A moment for each town a champion's players are from.
  const hometown = config.hometown && service ? new HometownJob(service, { rosters: athletes }) : null;
  log("INFO", "Moment engine starting", {
    leagues: config.leagues,
    store: store.kind,
    once: config.once,
    tagging: !!tagger,
    athletes: athletes ? (config.wikidata ? "with Wikidata" : "without Wikidata") : false,
    hometown: !!hometown,
  });

  if (config.once) {
    await Promise.all(pollers.map((p) => p.tick()));
    for (const p of pollers) log("INFO", `Polled ${p.league.id}`, { ...p.status });
    return;
  }

  const startedAt = new Date().toISOString();
  const server = startHealthServer(config.port, () => {
    const leagues = pollers.map((p) => p.status);
    return { ok: isHealthy(leagues), startedAt, store: store.kind, leagues };
  });

  let stopping = false;
  const timers = new Map<LeaguePoller, NodeJS.Timeout>();
  const loop = async (p: LeaguePoller): Promise<void> => {
    if (stopping) return;
    const delay = await p.tick();
    if (!stopping) timers.set(p, setTimeout(() => void loop(p), delay));
  };
  // Stagger the first polls so leagues don't all hit the feed at once.
  pollers.forEach((p, i) => timers.set(p, setTimeout(() => void loop(p), i * 1500)));

  // The tagger looks for new uploads once the first polls are under way.
  let tagTimer: NodeJS.Timeout | undefined;
  const tagLoop = async (t: CatalogTagger): Promise<void> => {
    if (stopping) return;
    const delay = await t.tick();
    if (!stopping) tagTimer = setTimeout(() => void tagLoop(t), delay);
  };
  if (tagger) tagTimer = setTimeout(() => void tagLoop(tagger), 15_000);

  // So does the athlete sync, a little later.
  let athleteTimer: NodeJS.Timeout | undefined;
  const athleteLoop = async (a: AthleteSync): Promise<void> => {
    if (stopping) return;
    const delay = await a.tick();
    if (!stopping) athleteTimer = setTimeout(() => void athleteLoop(a), delay);
  };
  if (athletes) athleteTimer = setTimeout(() => void athleteLoop(athletes), 30_000);

  // And the hometown job, which reads the titles the polls saved.
  let hometownTimer: NodeJS.Timeout | undefined;
  const hometownLoop = async (h: HometownJob): Promise<void> => {
    if (stopping) return;
    const delay = await h.tick();
    if (!stopping) hometownTimer = setTimeout(() => void hometownLoop(h), delay);
  };
  if (hometown) hometownTimer = setTimeout(() => void hometownLoop(hometown), 45_000);

  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log("INFO", `Shutting down on ${signal}`);
    for (const t of timers.values()) clearTimeout(t);
    clearTimeout(tagTimer);
    clearTimeout(athleteTimer);
    clearTimeout(hometownTimer);
    server.close();
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  log("ERROR", "Moment engine crashed", { error: errorMessage(e) });
  process.exit(1);
});
