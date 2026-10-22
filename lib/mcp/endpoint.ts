// The MCP endpoint: checks the access token, then answers the request with a
// fresh, stateless server for that person.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CORS, resourceMetadataUrl, resourceOf, SCOPE } from "./oauth/config";
import { principalFor } from "./oauth/store";
import { createWalkoffServer } from "./server";

function unauthorized(origin: string, hadToken: boolean): Response {
  const params = [`resource_metadata="${resourceMetadataUrl(origin)}"`, `scope="${SCOPE}"`];
  if (hadToken) params.push('error="invalid_token"', 'error_description="The access token is invalid or expired"');
  return Response.json(
    { error: hadToken ? "invalid_token" : "unauthorized", error_description: "Sign in by connecting Walkoff in Claude." },
    { status: 401, headers: { ...CORS, "WWW-Authenticate": `Bearer ${params.join(", ")}`, "Cache-Control": "no-store" } },
  );
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function handleMcp(db: SupabaseClient, req: Request, origin: string, now = () => new Date()): Promise<Response> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  const principal = token ? await principalFor(db, token, resourceOf(origin)) : null;
  if (!principal || !token) return unauthorized(origin, !!token);
  // Stateless: no server-sent event stream to open, no session to end.
  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
  }

  const server = createWalkoffServer({ db, principal, now });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(req, {
      authInfo: { token, clientId: principal.clientId, scopes: [principal.scope], resource: new URL(resourceOf(origin)), extra: { email: principal.email } },
    });
    return withCors(res);
  } finally {
    await server.close();
  }
}
