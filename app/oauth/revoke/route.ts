import { CORS } from "@/lib/mcp/oauth/config";
import { preflight, revokeToken } from "@/lib/mcp/oauth/handlers";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return await revokeToken(getServiceSupabase(), req);
  } catch (e) {
    console.error("OAuth revoke failed", e);
    return Response.json({ error: "server_error" }, { status: 500, headers: CORS });
  }
}

export const OPTIONS = preflight;
