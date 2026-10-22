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

export async function runStatusChecks(): Promise<StatusReport> {
  const [leagues, platform, integrations] = await Promise.all([
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
  ]);
  return { checkedAt: new Date().toISOString(), leagues, platform, integrations };
}

export function overallState(report: StatusReport): CheckState {
  const all = [...report.leagues, ...report.platform, ...report.integrations];
  if (all.some((c) => c.state === "down")) return "down";
  if (all.some((c) => c.state === "degraded")) return "degraded";
  return "operational";
}
