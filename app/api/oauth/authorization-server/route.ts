import { originOf } from "@/lib/mcp/oauth/config";
import { authorizationServer, preflight } from "@/lib/mcp/oauth/handlers";

// Served at /.well-known/oauth-authorization-server and
// /.well-known/openid-configuration (next.config.ts rewrites).
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return authorizationServer(originOf(req));
}

export const OPTIONS = preflight;
