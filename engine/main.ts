// Walkoff moment engine: polls live sports data, detects moments and saves
// them to Supabase. See engine/README.md.
import { LEAGUES } from "../lib/leagues";
import { loadConfig } from "./config";
import { createEspnClient } from "./espn/client";
import { isHealthy, startHealthServer } from "./health";
import { errorMessage, log } from "./log";
import { rulesFor } from "./moments/sports";
import { LeaguePoller } from "./poller";
import { MemoryStore } from "./store/memory";
import { createSupabaseStore } from "./store/supabase";
import type { Store } from "./store/types";

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
  log("INFO", "Moment engine starting", { leagues: config.leagues, store: store.kind, once: config.once });

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

  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log("INFO", `Shutting down on ${signal}`);
    for (const t of timers.values()) clearTimeout(t);
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
