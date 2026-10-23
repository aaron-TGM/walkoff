// Sign-ins in progress, authorization codes and tokens (supabase/006_mcp.sql).
// Codes and tokens are stored only as hashes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "../data";
import { operatorEmails, SCOPE, TTL } from "./config";
import { randomToken, sha256 } from "./crypto";
import { sweep } from "./limits";

export interface AuthRequest {
  id: string;
  client_id: string;
  redirect_uri: string;
  state: string | null;
  code_challenge: string;
  scope: string | null;
  resource: string;
  email: string | null;
  email_code_hash: string | null;
  codes_sent: number;
  attempts: number;
  verified_at: string | null;
  expires_at: string;
}

const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

export async function createRequest(
  db: SupabaseClient,
  r: Pick<AuthRequest, "client_id" | "redirect_uri" | "state" | "code_challenge" | "resource">,
): Promise<AuthRequest> {
  await sweep(db);
  const row = { ...r, id: randomToken("", 24), scope: SCOPE, expires_at: later(TTL.request) };
  const { data, error } = await db.from("oauth_requests").insert(row).select("*").single();
  if (error) throw error;
  return data as AuthRequest;
}

/** A sign-in that's still open, or null. */
export async function loadRequest(db: SupabaseClient, id: string | null): Promise<AuthRequest | null> {
  if (!id || !/^[A-Za-z0-9_-]{20,64}$/.test(id)) return null;
  const { data, error } = await db.from("oauth_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const r = data as AuthRequest | null;
  return r && Date.parse(r.expires_at) > Date.now() ? r : null;
}

export async function updateRequest(db: SupabaseClient, id: string, changes: Partial<AuthRequest>): Promise<void> {
  const { error } = await db.from("oauth_requests").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteRequest(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("oauth_requests").delete().eq("id", id);
  if (error) throw error;
}

export const emailCodeHash = (requestId: string, code: string) => sha256(`${requestId}:${code}`);

/** Codes emailed to an address in the last hour, across sign-ins. */
export async function codesSentTo(db: SupabaseClient, email: string): Promise<number> {
  const { data, error } = await db
    .from("oauth_requests")
    .select("codes_sent")
    .eq("email", email)
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if (error) throw error;
  return (data ?? []).reduce((n, r) => n + (r.codes_sent as number), 0);
}

// ── Who can use which brands ───────────────────────────────────────

export interface Access {
  operator: boolean;
  brands: { id: string; name: string }[];
}

/** Operators (WALKOFF_OPERATOR_EMAILS) reach every brand; everyone else
 *  the brands they were invited to (npm run brand -- invite). */
export async function accessFor(db: SupabaseClient, email: string): Promise<Access> {
  const operator = operatorEmails().has(email);
  if (operator) {
    const { data, error } = await db.from("brands").select("id, name").order("name");
    if (error) throw error;
    return { operator, brands: (data ?? []) as Access["brands"] };
  }
  const { data: members, error } = await db.from("brand_members").select("brand_id").eq("email", email);
  if (error) throw error;
  const ids = (members ?? []).map((m) => m.brand_id as string);
  if (!ids.length) return { operator, brands: [] };
  const { data, error: brandsError } = await db.from("brands").select("id, name").in("id", ids).order("name");
  if (brandsError) throw brandsError;
  return { operator, brands: (data ?? []) as Access["brands"] };
}

/** The brands a grant still reaches, given access today: null for every
 *  brand (operators only). Empty when access was taken away. */
export function stillAllowed(grantBrands: string[] | null, access: Access): string[] | null {
  const now = access.brands.map((b) => b.id);
  if (grantBrands === null) return access.operator ? null : now;
  return grantBrands.filter((id) => access.operator || now.includes(id));
}

// ── Codes and tokens ───────────────────────────────────────────────

export interface Grant {
  token_hash: string;
  kind: "code" | "access" | "refresh";
  client_id: string;
  email: string;
  brand_ids: string[] | null;
  scope: string | null;
  resource: string;
  redirect_uri: string | null;
  code_challenge: string | null;
  expires_at: string;
  used_at: string | null;
}

export async function issueCode(
  db: SupabaseClient,
  g: Pick<Grant, "client_id" | "email" | "brand_ids" | "scope" | "resource" | "redirect_uri" | "code_challenge">,
): Promise<string> {
  const code = randomToken("wo_code_");
  const { error } = await db.from("oauth_grants").insert({ ...g, token_hash: sha256(code), kind: "code", expires_at: later(TTL.code) });
  if (error) throw error;
  return code;
}

/** Spends a code or refresh token: marks it used and returns it, once.
 *  Null when it doesn't exist, was already used, or has expired. */
export async function spend(db: SupabaseClient, token: string, kind: "code" | "refresh"): Promise<Grant | null> {
  const { data, error } = await db
    .from("oauth_grants")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .eq("kind", kind)
    .is("used_at", null)
    .select("*");
  if (error) throw error;
  const g = (data?.[0] as Grant | undefined) ?? null;
  return g && Date.parse(g.expires_at) > Date.now() ? g : null;
}

export interface Tokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function issueTokens(
  db: SupabaseClient,
  g: Pick<Grant, "client_id" | "email" | "brand_ids" | "resource"> & { scope: string | null },
): Promise<Tokens> {
  const access = randomToken("wo_at_");
  const refresh = randomToken("wo_rt_");
  const base = { client_id: g.client_id, email: g.email, brand_ids: g.brand_ids, scope: g.scope ?? SCOPE, resource: g.resource };
  const { error } = await db.from("oauth_grants").insert([
    { ...base, token_hash: sha256(access), kind: "access", expires_at: later(TTL.access) },
    { ...base, token_hash: sha256(refresh), kind: "refresh", expires_at: later(TTL.refresh) },
  ]);
  if (error) throw error;
  return { access_token: access, token_type: "Bearer", expires_in: TTL.access, refresh_token: refresh, scope: base.scope };
}

/** Revokes a token (RFC 7009), quietly, and with it the whole connection:
 *  every access and refresh token the same app holds for the same person. */
export async function revoke(db: SupabaseClient, token: string): Promise<void> {
  const { data, error } = await db.from("oauth_grants").select("client_id, email").eq("token_hash", sha256(token)).maybeSingle();
  if (error) throw error;
  if (!data) return;
  const gone = await db
    .from("oauth_grants")
    .delete()
    .eq("client_id", data.client_id)
    .eq("email", data.email)
    .in("kind", ["access", "refresh"]);
  if (gone.error) throw gone.error;
}

/** Connections these people still have, with the brands each reaches (null:
 *  every brand). A connection is its current refresh token: each sign-in and
 *  refresh writes a new one and spends the last, while an access token from
 *  before a refresh can reach more brands than the connection now does. */
export async function liveGrants(db: SupabaseClient, emails: string[], now = new Date()): Promise<Pick<Grant, "email" | "brand_ids">[]> {
  if (!emails.length) return [];
  const { data, error } = await db
    .from("oauth_grants")
    .select("email, brand_ids")
    .in("email", emails)
    .eq("kind", "refresh")
    .is("used_at", null)
    .gt("expires_at", now.toISOString());
  if (error) throw error;
  return (data ?? []) as Pick<Grant, "email" | "brand_ids">[];
}

/** Who an access token belongs to, with brand access checked again now, or
 *  null when it isn't valid for this resource. */
export async function principalFor(db: SupabaseClient, token: string, resource: string): Promise<Principal | null> {
  if (!/^wo_at_[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const { data, error } = await db
    .from("oauth_grants")
    .select("*")
    .eq("token_hash", sha256(token))
    .eq("kind", "access")
    .maybeSingle();
  if (error) throw error;
  const g = data as Grant | null;
  if (!g || g.used_at || Date.parse(g.expires_at) <= Date.now() || g.resource !== resource) return null;
  const brandIds = stillAllowed(g.brand_ids, await accessFor(db, g.email));
  return { email: g.email, brandIds, clientId: g.client_id, scope: g.scope ?? SCOPE };
}
