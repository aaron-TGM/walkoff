import { LEAGUES, type League } from "@/lib/leagues";
import { getServiceSupabase } from "@/lib/supabase";

export type CheckState =
  | "operational"
  | "degraded"
  | "down"
  | "not_configured";

export interface CheckResult {
  id: string;
  name: string;
  state: CheckState;
  detail: string;
  latencyMs?: number;
}

export interface StatusReport {
  checkedAt: string;
  leagues: CheckResult[];
  platform: CheckResult[];
  integrations: CheckResult[];
  /** One row per league from the moment engine, or null before it runs. */
  engine: CheckResult[] | null;
}

const FEED_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const TIMEOUT_MS = 6000;
const SLOW_MS = 2500;

export const STATE_LABEL: Record<CheckState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not configured",
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

function speedState(ms: number): CheckState {
  return ms > SLOW_MS ? "degraded" : "operational";
}

interface Scoreboard {
  events?: { status?: { type?: { state?: string } } }[];
}

async function checkLeague(league: League): Promise<CheckResult> {
  const base = { id: league.id, name: `${league.name} live data` };
  try {
    const { value: res, ms } = await timed(() =>
      fetch(`${FEED_BASE}/${league.feedPath}/scoreboard`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
      }),
    );
    if (!res.ok) {
      return { ...base, state: "down", detail: `Feed answered ${res.status}`, latencyMs: ms };
    }
    const data = (await res.json()) as Scoreboard;
    const events = data.events ?? [];
    const live = events.filter((e) => e.status?.type?.state === "in").length;
    const detail =
      events.length === 0
        ? "Responding · no games on the current slate"
        : `${events.length} ${events.length === 1 ? "game" : "games"} on the current slate · ${live} live now`;
    return { ...base, state: speedState(ms), detail, latencyMs: ms };
  } catch {
    return { ...base, state: "down", detail: "No response within 6 seconds" };
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const base = { id: "database", name: "Early access signups" };
  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return { ...base, state: "not_configured", detail: "Database credentials missing" };
  }
  try {
    const { value, ms } = await timed(async () =>
      supabase.from("waitlist").select("id").limit(1),
    );
    if (value.error) {
      return { ...base, state: "down", detail: "Database query failed", latencyMs: ms };
    }
    return { ...base, state: speedState(ms), detail: "Database responding", latencyMs: ms };
  } catch {
    return { ...base, state: "down", detail: "Database unreachable" };
  }
}

/** Any HTTP answer below 500 means the service is up and reachable. */
async function checkReachable(
  id: string,
  name: string,
  url: string,
  okDetail: string,
): Promise<CheckResult> {
  try {
    const { value: res, ms } = await timed(() =>
      fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }),
    );
    if (res.status >= 500) {
      return { id, name, state: "down", detail: `Answered ${res.status}`, latencyMs: ms };
    }
    return { id, name, state: speedState(ms), detail: okDetail, latencyMs: ms };
  } catch {
    return { id, name, state: "down", detail: "No response within 6 seconds" };
  }
}

async function checkNotifications(): Promise<CheckResult> {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_EMAIL) {
    return {
      id: "notifications",
      name: "Signup notifications",
      state: "not_configured",
      detail: "Email provider key or inbox missing",
    };
  }
  return checkReachable(
    "notifications",
    "Signup notifications",
    "https://api.resend.com",
    "Email provider reachable",
  );
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export interface HeartbeatRow {
  league: string;
  last_poll_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
  live_games: number;
  consecutive_failures: number;
}

/** One status row per league from the engine's heartbeats. The engine polls
 *  at least every 5 minutes, so 15 minutes without a good poll is down. */
export function engineChecks(
  rows: HeartbeatRow[],
  momentsToday: Map<string, number>,
  now: number,
): CheckResult[] {
  const byLeague = new Map(rows.map((r) => [r.league, r]));
  return LEAGUES.filter((l) => byLeague.has(l.id)).map((l) => {
    const r = byLeague.get(l.id)!;
    const sinceOk = r.last_ok_at ? now - Date.parse(r.last_ok_at) : Infinity;
    const moments = momentsToday.get(l.id) ?? 0;
    const state: CheckState =
      sinceOk > 15 * 60_000 ? "down" : r.consecutive_failures > 0 ? "degraded" : "operational";
    const lastPoll = r.last_poll_at ?? r.last_ok_at;
    const detail =
      state === "operational" && lastPoll
        ? `Polled ${ago(now - Date.parse(lastPoll))} · ${r.live_games} live · ${moments} ${moments === 1 ? "moment" : "moments"} today`
        : // Raw errors can name internal URLs and tables; they stay in the logs.
          `Last good poll ${r.last_ok_at ? ago(sinceOk) : "never"}${r.last_error ? " · retrying" : ""}`;
    return { id: `engine-${l.id}`, name: `${l.name} moments`, state, detail };
  });
}

async function checkEngine(): Promise<CheckResult[] | null> {
  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return null;
  }
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [beats, today] = await Promise.all([
      supabase
        .from("engine_heartbeats")
        .select("league, last_poll_at, last_ok_at, last_error, live_games, consecutive_failures"),
      supabase.from("moments").select("league").gte("detected_at", startOfDay.toISOString()),
    ]);
    // No table yet, or the engine has never run.
    if (beats.error || !beats.data?.length) return null;
    const momentsToday = new Map<string, number>();
    for (const m of today.data ?? []) {
      momentsToday.set(m.league, (momentsToday.get(m.league) ?? 0) + 1);
    }
    return engineChecks(beats.data as HeartbeatRow[], momentsToday, Date.now());
  } catch {
    return null;
  }
}

export async function runStatusChecks(): Promise<StatusReport> {
  const [leagues, platform, integrations, engine] = await Promise.all([
    Promise.all(LEAGUES.map(checkLeague)),
    Promise.all([
      Promise.resolve<CheckResult>({
        id: "website",
        name: "Website",
        state: "operational",
        detail: "Serving walkoff.io",
      }),
      checkDatabase(),
      checkNotifications(),
    ]),
    Promise.all([
      checkReachable(
        "klaviyo",
        "Klaviyo API",
        "https://a.klaviyo.com/api/accounts",
        "Reachable from Walkoff",
      ),
    ]),
    checkEngine(),
  ]);
  return { checkedAt: new Date().toISOString(), leagues, platform, integrations, engine };
}

export function overallState(report: StatusReport): CheckState {
  const all = [
    ...report.leagues,
    ...report.platform,
    ...report.integrations,
    ...(report.engine ?? []),
  ];
  if (all.some((c) => c.state === "down")) return "down";
  if (all.some((c) => c.state === "degraded")) return "degraded";
  return "operational";
}
