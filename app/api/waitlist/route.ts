import { NextResponse } from "next/server";
import { Resend } from "resend";

import { LEAGUE_IDS, LEAGUES } from "@/lib/leagues";
import { callerKey, overLimit } from "@/lib/mcp/oauth/limits";
import { getServiceSupabase } from "@/lib/supabase";
import {
  cleanAttribution,
  insertSignup,
  PLATFORMS,
  ROLES,
  sourceLines,
  type WaitlistSubmission,
} from "@/lib/waitlist";

const MAX_LEN = 300;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "";
}

function oneOf<T extends string>(v: string, options: readonly T[]): T | null {
  return (options as readonly string[]).includes(v) ? (v as T) : null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // Honeypot filled in: pretend it worked so bots don't retry.
  if (str(raw.fax)) {
    return NextResponse.json({ ok: true });
  }

  const role = oneOf(str(raw.role), ROLES);
  const platform = oneOf(str(raw.platform), PLATFORMS);
  const submission: WaitlistSubmission | null =
    role && platform
      ? {
          company: str(raw.company),
          email: str(raw.email).toLowerCase(),
          website: str(raw.website),
          role,
          platform,
          leagues: Array.isArray(raw.leagues)
            ? raw.leagues.filter(
                (l): l is string => typeof l === "string" && LEAGUE_IDS.has(l),
              )
            : [],
          teams: str(raw.teams),
        }
      : null;

  if (!submission || !submission.company || !submission.email) {
    return NextResponse.json(
      { error: "Please fill in your brand, email, role and email platform." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Each request is a row and an email, so a script can't send thousands.
  try {
    if (await overLimit(getServiceSupabase(), "waitlist", callerKey(req))) {
      return NextResponse.json(
        { error: "Too many requests from your network in the last hour. Try again later, or email hello@walkoff.io." },
        { status: 429 },
      );
    }
  } catch (e) {
    console.error("Waitlist limit check failed", e);
  }

  const leagueNames = submission.leagues
    .map((id) => LEAGUES.find((l) => l.id === id)?.name ?? id)
    .join(", ");

  // Where the request came from. Never a reason to turn it away.
  const attribution = cleanAttribution(raw.attribution);

  // Save to Supabase, but never lose a lead over it: if the insert fails,
  // the notification email below still carries every field.
  let saved = false;
  let missingColumns = false;
  try {
    const supabase = getServiceSupabase();
    const result = await insertSignup(
      supabase,
      {
        company: submission.company,
        email: submission.email,
        website: submission.website || null,
        role: submission.role,
        platform: submission.platform,
        leagues: submission.leagues,
        teams: submission.teams || null,
        // Legacy columns from the first waitlist schema.
        league: leagueNames || null,
        team: submission.teams || null,
      },
      attribution,
    );
    if (result.error) throw result.error;
    saved = true;
    missingColumns = result.missingColumns;
  } catch (e) {
    console.error("Waitlist insert failed", e);
  }

  let notified = false;
  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFICATION_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Walkoff <onboarding@resend.dev>";

  if (resendKey && notifyTo) {
    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from,
        to: notifyTo,
        replyTo: submission.email,
        subject: `New Walkoff early access: ${submission.company} (${submission.role})`,
        text: [
          `Company: ${submission.company}`,
          `Email: ${submission.email}`,
          `Website: ${submission.website || "-"}`,
          `Role: ${submission.role}`,
          `Platform: ${submission.platform}`,
          `Leagues: ${leagueNames || "-"}`,
          `Teams / markets: ${submission.teams || "-"}`,
          "",
          ...sourceLines(attribution),
          "",
          !saved
            ? "NOT saved to Supabase (insert failed). This email is the only record."
            : missingColumns
              ? "Saved to Supabase, without where it came from: run supabase/008_waitlist_attribution.sql."
              : "Saved to Supabase.",
        ].join("\n"),
      });
      if (error) throw error;
      notified = true;
    } catch (e) {
      console.error("Resend failed", e);
    }
  }

  if (!saved && !notified) {
    return NextResponse.json(
      { error: "Could not save your request. Please email hello@walkoff.io." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
