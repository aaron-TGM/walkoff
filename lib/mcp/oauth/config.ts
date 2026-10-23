// Where things live and how long they last, for the OAuth server Claude's
// connector signs in through (MCP authorization spec; RFC 8414, 9728, 7591,
// 8707, 9207 and the client ID metadata document draft).
import { helpUrl } from "../../help/pages";

export const SCOPE = "walkoff";
export const TTL = {
  /** A sign-in in progress, from the authorize link to the consent click. */
  request: 15 * 60,
  code: 10 * 60,
  access: 24 * 60 * 60,
  refresh: 90 * 24 * 60 * 60,
} as const;
/** Emailed codes per sign-in and per address per hour, and wrong guesses
 *  per code. */
export const LIMITS = { codesSent: 5, codesPerEmailHour: 10, attempts: 5 } as const;
export const COOKIE = "walkoff_oauth";

/** This deployment's public origin: WALKOFF_PUBLIC_URL when set, else the
 *  request's own (https://www.walkoff.io in production). */
let warned = false;

export function originOf(req: Request): string {
  const configured = process.env.WALKOFF_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production" && !warned) {
    warned = true;
    console.warn("WALKOFF_PUBLIC_URL isn't set: OAuth uses each request's own host. Set it to https://www.walkoff.io.");
  }
  return new URL(req.url).origin;
}

export const resourceOf = (origin: string) => `${origin}/mcp`;
export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource/mcp`;

/** The canonical resource for a requested one: the MCP endpoint, with or
 *  without a trailing slash. Null when it names something else. */
export function canonicalResource(origin: string, requested: string | null | undefined): string | null {
  const resource = resourceOf(origin);
  if (!requested) return resource;
  return requested === resource || requested === `${resource}/` ? resource : null;
}

/** RFC 9728: what Claude reads first, from the 401's resource_metadata. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: resourceOf(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Walkoff",
    resource_documentation: helpUrl(origin, "tools"),
  };
}

/** RFC 8414. Claude uses client ID metadata documents when this says they
 *  work and public clients ("none") are allowed; others register (RFC 7591). */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [SCOPE],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: helpUrl(origin, "connect"),
  };
}

/** People who can use Walkoff for every brand (WALKOFF_OPERATOR_EMAILS). */
export function operatorEmails(): Set<string> {
  return new Set(
    (process.env.WALKOFF_OPERATOR_EMAILS ?? "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
} as const;
