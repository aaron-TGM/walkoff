// Where an athlete was born, from ESPN's core API, for tennis and racing.
// Racing gives a city and a state ("Elk Grove", "CA"), tennis one line
// ("Irvine, CA, USA", "Cincinnati, Ohio", or just "Worcester"). The line goes
// whole into the city: lib/places reads it as a town, and a bare name that
// could be anywhere stays unknown rather than guessed.
import { getJson } from "../espn/client";
import type { Bio } from "./poller";

const CORE = "https://sports.core.api.espn.com/v2/sports";

const text = (s: string | undefined) => s?.trim() ?? "";

/** What some bios say instead of nothing: "N/A", "NOT KNOWN, ZZ". */
const NOTHING = /^(n\/a|not known|unknown)\b/i;

export function parseCoreBio(json: unknown): Bio | null {
  const b = (json as { birthPlace?: { city?: string; state?: string; country?: string; summary?: string } | null })?.birthPlace;
  const summary = text(b?.summary);
  if (summary) return NOTHING.test(summary) ? null : { city: summary, state: "", country: "" };
  const city = text(b?.city);
  return city && !NOTHING.test(city) ? { city, state: text(b?.state), country: text(b?.country) } : null;
}

/** An athlete's bio in a league: "racing/leagues/nascar-premier". */
export async function coreBio(path: string, externalId: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<Bio | null> {
  return parseCoreBio(await getJson(`${CORE}/${path}/athletes/${encodeURIComponent(externalId)}`, timeoutMs, fetchImpl));
}
