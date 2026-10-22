import { handleMcp } from "@/lib/mcp/endpoint";
import { CORS, originOf } from "@/lib/mcp/oauth/config";
import { getServiceSupabase } from "@/lib/supabase";

// Claude's connector talks to Walkoff here: https://www.walkoff.io/mcp
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request): Promise<Response> {
  try {
    return await handleMcp(getServiceSupabase(), req, originOf(req));
  } catch (e) {
    console.error("MCP request failed", e);
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Walkoff is having trouble right now. Try again in a minute." }, id: null },
      { status: 500, headers: CORS },
    );
  }
}

export { handle as GET, handle as POST, handle as DELETE };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
