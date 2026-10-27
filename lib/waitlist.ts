import type { SupabaseClient } from "@supabase/supabase-js";

export const ROLES = ["Brand", "Agency", "Local business", "Other"] as const;

export const PLATFORMS = [
  "Klaviyo",
  "Shopify Email",
  "Omnisend",
  "Mailchimp",
  "Attentive",
  "Postscript",
  "Other / not sure",
] as const;

/** Where the demo map (/upload/demo) leaves the standout teams from a
 *  visitor's own file, for the early access form's Teams field. Team names
 *  only, in this tab only: nothing else from the file, and never in a URL. */
export const DEMO_TEAMS_KEY = "walkoff:demo-teams";

export interface WaitlistSubmission {
  company: string;
  email: string;
  website: string;
  role: (typeof ROLES)[number];
  platform: (typeof PLATFORMS)[number];
  leagues: string[];
  teams: string;
}

/** Where a request came from, as the form sends it (lib/analytics.ts): the
 *  visit's campaign tags, the site that sent it, the page it landed on and
 *  the early access button clicked. Columns from 008_waitlist_attribution.sql. */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_path",
  "cta_placement",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

/** The known keys only, trimmed to 300 characters. A value with an @ in it
 *  is dropped: no email address belongs here. */
export function cleanAttribution(raw: unknown): Attribution {
  const clean: Attribution = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const key of ATTRIBUTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    const text = typeof value === "string" ? value.trim().slice(0, 300) : "";
    if (text && !text.includes("@")) clean[key] = text;
  }
  return clean;
}

/** For the new-signup email. */
export function sourceLines(a: Attribution): string[] {
  const campaign = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" / ");
  const detail = [a.utm_content && `content ${a.utm_content}`, a.utm_term && `term ${a.utm_term}`].filter(Boolean).join(", ");
  const lines = [
    campaign || detail ? `Campaign: ${[campaign, detail && `(${detail})`].filter(Boolean).join(" ")}` : "",
    a.referrer ? `Came from: ${a.referrer}` : "",
    a.landing_path ? `Landed on: ${a.landing_path}` : "",
    a.cta_placement ? `Clicked: the ${a.cta_placement} button` : "",
  ].filter(Boolean);
  return lines.length ? lines : ["Source: not recorded"];
}

/** How PostgREST and Postgres say a column doesn't exist. */
const MISSING_COLUMN = new Set(["PGRST204", "42703"]);

/** Saves a request with where it came from. Until 008_waitlist_attribution.sql
 *  has run there are no columns for that, so it's saved without, and
 *  missingColumns says so. */
export async function insertSignup(
  db: SupabaseClient,
  row: Record<string, unknown>,
  attribution: Attribution,
): Promise<{ error: { message: string; code?: string } | null; missingColumns: boolean }> {
  if (Object.keys(attribution).length) {
    const { error } = await db.from("waitlist").insert({ ...row, ...attribution });
    if (!error || !MISSING_COLUMN.has(error.code)) return { error, missingColumns: false };
  }
  const { error } = await db.from("waitlist").insert(row);
  return { error, missingColumns: Object.keys(attribution).length > 0 };
}
