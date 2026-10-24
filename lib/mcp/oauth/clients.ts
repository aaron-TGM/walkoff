// The apps that can ask for access. Claude names itself with a client ID
// metadata document (its client_id is an https URL to a JSON file listing
// its redirect addresses); other apps register first (RFC 7591).
import type { SupabaseClient } from "@supabase/supabase-js";
import { hostVerdict } from "../../public-fetch";
import { randomToken } from "./crypto";

export { privateAddress } from "../../public-fetch";

export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  kind: "dcr" | "cimd";
}

export class ClientError extends Error {}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const CIMD_TTL_MS = 24 * 3_600_000;
const CIMD_STALE_MS = 7 * 24 * 3_600_000;
const MAX_DOCUMENT_BYTES = 64 * 1024;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** https anywhere, http only on this machine (native apps, RFC 8252), or a
 *  reverse-domain app scheme ("com.example.app:/callback"). */
export function validRedirectUri(uri: string): boolean {
  const u = parse(uri);
  if (!u || u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return LOOPBACK.has(u.hostname);
  return /^[a-z][a-z0-9+-]*(\.[a-z0-9+-]+)+:$/.test(u.protocol);
}

/** Exact match, except that loopback addresses match on any port. */
export function redirectAllowed(registered: string[], requested: string): boolean {
  const req = parse(requested);
  if (!req || !validRedirectUri(requested)) return false;
  return registered.some((r) => {
    if (r === requested) return true;
    const reg = parse(r);
    return (
      !!reg &&
      reg.protocol === "http:" &&
      req.protocol === "http:" &&
      LOOPBACK.has(reg.hostname) &&
      reg.hostname === req.hostname &&
      reg.pathname === req.pathname &&
      reg.search === req.search
    );
  });
}

/** What the consent screen shows as the app's address. */
export function redirectHost(uri: string): string {
  const u = parse(uri);
  if (!u) return uri;
  return u.protocol === "https:" || u.protocol === "http:" ? u.host : u.protocol.replace(/:$/, "");
}

/** A client ID that's a metadata document URL: https, a path, and a public
 *  host name (not an IP address or a local name). */
export function isMetadataUrl(clientId: string): boolean {
  const u = parse(clientId);
  if (!u || u.protocol !== "https:" || u.pathname === "/" || u.hash || u.username || u.password) return false;
  const host = u.hostname;
  if (LOOPBACK.has(host) || host.includes(":") || /^\d+(\.\d+){3}$/.test(host)) return false;
  return host.includes(".") && !/\.(local|internal|localhost)$/.test(host);
}

/** True when every address the host resolves to is public. Checked before
 *  fetching, so a public name can't point Walkoff at an internal address. */
async function resolvesPublic(host: string): Promise<boolean> {
  return (await hostVerdict(host)) === "public";
}

/** Checks a fetched metadata document (draft-ietf-oauth-client-id-metadata-document). */
export function readMetadataDocument(clientId: string, doc: unknown): Omit<OAuthClient, "kind"> {
  if (!doc || typeof doc !== "object") throw new ClientError("The app's metadata isn't a JSON object.");
  const d = doc as Record<string, unknown>;
  if (d.client_id !== clientId) throw new ClientError("The app's metadata names a different client_id.");
  const uris = d.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || !uris.every((u) => typeof u === "string" && validRedirectUri(u))) {
    throw new ClientError("The app's metadata has no usable redirect_uris.");
  }
  const method = d.token_endpoint_auth_method;
  if (method !== undefined && method !== "none") throw new ClientError("Walkoff only signs in public apps (token_endpoint_auth_method none).");
  const name = typeof d.client_name === "string" ? d.client_name.trim().slice(0, 100) : null;
  return { client_id: clientId, client_name: name || null, redirect_uris: uris as string[] };
}

async function fetchMetadataDocument(clientId: string): Promise<Omit<OAuthClient, "kind">> {
  if (!(await resolvesPublic(new URL(clientId).hostname))) throw new ClientError("The app's metadata isn't on a public address.");
  let res: Response;
  try {
    res = await fetch(clientId, { headers: { Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(5000) });
  } catch {
    throw new ClientError("Walkoff couldn't load the app's metadata.");
  }
  if (!res.ok) throw new ClientError(`The app's metadata returned HTTP ${res.status}.`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_DOCUMENT_BYTES) throw new ClientError("The app's metadata is too large.");
  const text = await res.text();
  if (text.length > MAX_DOCUMENT_BYTES) throw new ClientError("The app's metadata is too large.");
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new ClientError("The app's metadata isn't valid JSON.");
  }
  return readMetadataDocument(clientId, doc);
}

/** The app behind a client_id, or null when no such app registered. Metadata
 *  documents are cached for a day (a week if the app's site is down). */
export async function getClient(db: SupabaseClient, clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await db
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris, kind, fetched_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!isMetadataUrl(clientId)) return data && data.kind === "dcr" ? (data as OAuthClient) : null;

  const age = data ? Date.now() - Date.parse(data.fetched_at as string) : Infinity;
  if (data && age < CIMD_TTL_MS) return data as OAuthClient;
  try {
    const fresh = await fetchMetadataDocument(clientId);
    const row = { ...fresh, kind: "cimd" as const, fetched_at: new Date().toISOString() };
    const saved = await db.from("oauth_clients").upsert(row, { onConflict: "client_id" });
    if (saved.error) throw saved.error;
    return { ...fresh, kind: "cimd" };
  } catch (err) {
    if (err instanceof ClientError && data && age < CIMD_STALE_MS) return data as OAuthClient;
    throw err;
  }
}

/** Dynamic client registration (RFC 7591). Every client is public: it
 *  proves itself with PKCE, not a secret. */
export async function registerClient(db: SupabaseClient, body: unknown) {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every((u) => typeof u === "string" && validRedirectUri(u))) {
    throw new ClientError("redirect_uris must list https addresses, or http on localhost.");
  }
  const grants = Array.isArray(b.grant_types) ? (b.grant_types as unknown[]) : ["authorization_code", "refresh_token"];
  if (!grants.every((g) => g === "authorization_code" || g === "refresh_token")) {
    throw new ClientError("Only the authorization_code and refresh_token grants are supported.");
  }
  const responses = Array.isArray(b.response_types) ? (b.response_types as unknown[]) : ["code"];
  if (!responses.every((r) => r === "code")) throw new ClientError("Only response_type code is supported.");
  const name = typeof b.client_name === "string" ? b.client_name.trim().slice(0, 100) || null : null;

  const client: OAuthClient = { client_id: randomToken("wo_client_", 16), client_name: name, redirect_uris: uris as string[], kind: "dcr" };
  const { error } = await db.from("oauth_clients").insert(client);
  if (error) throw error;
  return {
    client_id: client.client_id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name ?? undefined,
    redirect_uris: client.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}
