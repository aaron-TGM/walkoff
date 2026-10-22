import type { EspnScoreboard, EspnSummary } from "./types";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

export interface FeedClient {
  scoreboard(feedPath: string, query: string): Promise<EspnScoreboard>;
  summary(feedPath: string, eventId: string): Promise<EspnSummary>;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} from ${url}`);
  }
}

async function getJson<T>(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new HttpError(res.status, url);
      return (await res.json()) as T;
    } catch (e) {
      lastError = e;
      // A 4xx won't fix itself on a retry.
      if (e instanceof HttpError && e.status < 500) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError;
}

export function createEspnClient(
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): FeedClient {
  const timeoutMs = options.timeoutMs ?? 8000;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    scoreboard(feedPath, query) {
      const qs = query ? `?${query}` : "";
      return getJson(`${BASE}/${feedPath}/scoreboard${qs}`, timeoutMs, fetchImpl);
    },
    summary(feedPath, eventId) {
      return getJson(
        `${BASE}/${feedPath}/summary?event=${encodeURIComponent(eventId)}`,
        timeoutMs,
        fetchImpl,
      );
    },
  };
}
