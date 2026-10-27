// Caps on the endpoints anyone can call without signing in (app
// registration, starting a sign-in, and the early access form), so nobody
// can fill the database, make Walkoff fetch pages or send email for them:
// per caller per hour, and overall as a backstop. And per email address, on
// the codes sent to it and the wrong codes tried for it. Uses oauth_events
// (supabase/007_hardening.sql).
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const keyed = (value: string) =>
  createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "walkoff").update(value).digest("hex").slice(0, 32);
const hourAgo = () => new Date(Date.now() - 3_600_000).toISOString();

export const RATE = {
  register: { perCaller: 20, total: 300 },
  authorize: { perCaller: 60, total: 1500 },
  waitlist: { perCaller: 10, total: 500 },
} as const;
export type RateKind = keyof typeof RATE;

/** The caller, as a keyed hash of their IP: enough to count calls, never
 *  the address itself. Vercel sets x-real-ip and x-forwarded-for. */
export function callerKey(req: Request): string {
  const ip =
    req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return keyed(ip);
}

/** Records the call and says whether it went over a cap. Lets calls through
 *  if the events table isn't there yet (before 007_hardening.sql). */
export async function overLimit(db: SupabaseClient, kind: RateKind, caller: string): Promise<boolean> {
  const since = hourAgo();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await q;
    if (error) throw error;
    return n ?? 0;
  };
  try {
    const events = () => db.from("oauth_events").select("id", { count: "exact", head: true }).eq("kind", kind).gte("at", since);
    const [mine, all] = await Promise.all([count(events().eq("ip", caller)), count(events())]);
    if (mine >= RATE[kind].perCaller || all >= RATE[kind].total) return true;
    const { error } = await db.from("oauth_events").insert({ kind, ip: caller });
    if (error) throw error;
    return false;
  } catch (err) {
    console.warn("Walkoff sign-in limits are off until supabase/007_hardening.sql runs", err);
    return false;
  }
}

/** What happened to an email address in a sign-in: a code sent to it, or a
 *  wrong code tried for it. */
export type EmailEvent = "code_sent" | "wrong_code";

const emailKey = (email: string) => keyed(`email:${email}`);

/** How many times that happened to the address in the last hour, across
 *  every sign-in, so starting one over doesn't reset it. Counted by a keyed
 *  hash of the address (in the ip column), never the address. 0 until
 *  007_hardening.sql runs. */
export async function emailEvents(db: SupabaseClient, kind: EmailEvent, email: string): Promise<number> {
  const { count, error } = await db
    .from("oauth_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("ip", emailKey(email))
    .gte("at", hourAgo());
  if (error) {
    console.warn("Walkoff sign-in limits are off until supabase/007_hardening.sql runs", error);
    return 0;
  }
  return count ?? 0;
}

export async function recordEmailEvent(db: SupabaseClient, kind: EmailEvent, email: string): Promise<void> {
  const { error } = await db.from("oauth_events").insert({ kind, ip: emailKey(email) });
  if (error) console.warn("Walkoff sign-in limits are off until supabase/007_hardening.sql runs", error);
}

/** Clears finished sign-ins, expired tokens, old call records and apps that
 *  never signed anyone in. Best effort: skipped until 007 runs. */
export async function sweep(db: SupabaseClient): Promise<void> {
  const { error } = await db.rpc("walkoff_sweep_oauth");
  if (error) console.warn("Walkoff sign-in sweep skipped", error.message);
}
