import { NextResponse } from "next/server";

import { brandByToken, catalogStats, recomputeReport, saveCatalog } from "@/lib/affinity/store";
import { parseCatalogUpload, UploadError } from "@/lib/affinity/validate";
import { getServiceSupabase } from "@/lib/supabase";

/** Saves a brand's products with rule-based tags and returns what's on
 *  file and the updated report (null until customers are uploaded). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const db = getServiceSupabase();
    const brand = await brandByToken(db, token);
    if (!brand) return NextResponse.json({ error: "This upload link isn't valid." }, { status: 404 });
    const { format, items } = parseCatalogUpload(await req.json());
    await saveCatalog(db, brand, format, items);
    const [stats, report] = await Promise.all([catalogStats(db, brand.id), recomputeReport(db, brand)]);
    return NextResponse.json({ ok: true, ...stats, report });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Catalog upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
