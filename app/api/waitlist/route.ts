import { NextResponse } from "next/server";
import { Resend } from "resend";

import { getServiceSupabase } from "@/lib/supabase";

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

  const { company, email, league, team } = body as Record<string, unknown>;

  const requiredFields = [company, email, league, team];
  if (requiredFields.some((v) => typeof v !== "string" || !String(v).trim())) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 },
    );
  }

  const companyStr = String(company).trim();
  const emailStr = String(email).trim().toLowerCase();
  const leagueStr = String(league).trim();
  const teamStr = String(team).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const { error: dbError } = await supabase.from("waitlist").insert({
    company: companyStr,
    email: emailStr,
    league: leagueStr,
    team: teamStr,
  });

  if (dbError) {
    console.error(dbError);
    return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFICATION_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Walkoff <onboarding@resend.dev>";

  if (resendKey && notifyTo) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from,
        to: notifyTo,
        subject: `New Walkoff waitlist submission — ${companyStr}`,
        text: [
          `Company: ${companyStr}`,
          `Email: ${emailStr}`,
          `League: ${leagueStr}`,
          `Team: ${teamStr}`,
        ].join("\n"),
      });
    } catch (e) {
      console.error("Resend failed", e);
      // brief: still success if DB worked
    }
  }

  return NextResponse.json({ ok: true });
}
