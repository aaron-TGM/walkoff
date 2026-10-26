import { NextResponse } from "next/server";
import { recordView } from "@/lib/outreach/store";
import { getServiceSupabase } from "@/lib/supabase";

/** One open of a pitch page, from its beacon. Answers the same whether or
 *  not the pitch exists, and a failure to count never shows. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await recordView(getServiceSupabase(), token);
  } catch (err) {
    console.error("Pitch view not counted", err);
  }
  return new NextResponse(null, { status: 204 });
}
