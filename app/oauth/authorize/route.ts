import { originOf } from "@/lib/mcp/oauth/config";
import { authorizeStart, authorizeStep } from "@/lib/mcp/oauth/handlers";
import { errorPage, HTML_HEADERS } from "@/lib/mcp/oauth/pages";
import { getServiceSupabase } from "@/lib/supabase";

// Where Claude sends someone to connect Walkoff: sign in with an emailed
// code, pick brands, approve.
export const dynamic = "force-dynamic";

function failed(e: unknown): Response {
  console.error("OAuth authorize failed", e);
  return new Response(errorPage("Walkoff hit an error. Try again in a minute."), { status: 500, headers: HTML_HEADERS });
}

export async function GET(req: Request) {
  return authorizeStart(getServiceSupabase(), req, originOf(req)).catch(failed);
}

export async function POST(req: Request) {
  return authorizeStep(getServiceSupabase(), req, originOf(req)).catch(failed);
}
