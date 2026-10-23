import { CORS } from "@/lib/mcp/oauth/config";
import { preflight, register } from "@/lib/mcp/oauth/handlers";
import { getServiceSupabase } from "@/lib/supabase";

// Dynamic client registration (RFC 7591), for apps without a client ID
// metadata document.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return await register(getServiceSupabase(), req);
  } catch (e) {
    console.error("OAuth registration failed", e);
    return Response.json({ error: "server_error", error_description: "Try again in a minute." }, { status: 500, headers: CORS });
  }
}

export const OPTIONS = preflight;
