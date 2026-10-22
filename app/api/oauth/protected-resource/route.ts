import { originOf } from "@/lib/mcp/oauth/config";
import { preflight, protectedResource } from "@/lib/mcp/oauth/handlers";

// Served at /.well-known/oauth-protected-resource (next.config.ts rewrites).
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return protectedResource(originOf(req));
}

export const OPTIONS = preflight;
