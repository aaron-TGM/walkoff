import { NextResponse } from "next/server";

import { brandByToken, recomputeReport, saveCustomerUpload } from "@/lib/affinity/store";
import { parseCustomerUpload, UploadError } from "@/lib/affinity/validate";
import { getServiceSupabase } from "@/lib/supabase";

/** Saves a brand's customer counts and returns its new affinity report. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const db = getServiceSupabase();
    const brand = await brandByToken(db, token);
    if (!brand) return NextResponse.json({ error: "This upload link isn't valid." }, { status: 404 });
    const upload = parseCustomerUpload(await req.json());
    await saveCustomerUpload(db, brand, upload);
    const report = await recomputeReport(db, brand);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Customer upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
