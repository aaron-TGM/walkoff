import { createServer, type Server } from "node:http";
import type { LeagueStatus } from "./poller";

export interface HealthSnapshot {
  ok: boolean;
  startedAt: string;
  store: string;
  leagues: LeagueStatus[];
}

/** Unhealthy only when every league keeps failing, so one flaky feed
 *  doesn't get the whole engine restarted. */
export function isHealthy(leagues: LeagueStatus[]): boolean {
  return leagues.length === 0 || leagues.some((l) => l.consecutiveFailures < 5);
}

export function startHealthServer(port: number, snapshot: () => HealthSnapshot): Server {
  const server = createServer((req, res) => {
    if (req.url === "/healthz" || req.url === "/") {
      const body = snapshot();
      res.writeHead(body.ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify(body, null, 2));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  });
  server.listen(port);
  return server;
}
