// The OAuth endpoints Claude's connector uses. Route files in app/ are thin
// wrappers around these, so the flow can be tested end to end.
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizationServerMetadata, canonicalResource, COOKIE, CORS, LIMITS, protectedResourceMetadata, SCOPE, TTL } from "./config";
import { ClientError, getClient, redirectAllowed, redirectHost, registerClient, type OAuthClient } from "./clients";
import { CHALLENGE, pkceMatches, randomToken, sameHash, sixDigits } from "./crypto";
import { sendSignInCode } from "./email";
import { callerKey, overLimit, sweep } from "./limits";
import { codePage, consentPage, emailPage, errorPage, HTML_HEADERS, type FlowView } from "./pages";
import {
  accessFor,
  codesSentTo,
  createRequest,
  deleteRequest,
  emailCodeHash,
  issueCode,
  issueTokens,
  loadRequest,
  revoke,
  spend,
  stillAllowed,
  updateRequest,
  type AuthRequest,
} from "./store";

const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...HTML_HEADERS, ...headers } });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...CORS, ...headers } });

const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status);

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export const protectedResource = (origin: string) =>
  json(protectedResourceMetadata(origin), 200, { "Cache-Control": "public, max-age=300" });

export const authorizationServer = (origin: string) =>
  json(authorizationServerMetadata(origin), 200, { "Cache-Control": "public, max-age=300" });

// ── Registration ───────────────────────────────────────────────────

export async function register(db: SupabaseClient, req: Request): Promise<Response> {
  if (await overLimit(db, "register", callerKey(req))) {
    return json({ error: "temporarily_unavailable", error_description: "Too many registrations. Try again later." }, 429, { "Retry-After": "600" });
  }
  await sweep(db);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return oauthError("invalid_client_metadata", "Send the client metadata as JSON.");
  }
  try {
    return json(await registerClient(db, body), 201);
  } catch (err) {
    if (err instanceof ClientError) {
      return oauthError(/redirect/i.test(err.message) ? "invalid_redirect_uri" : "invalid_client_metadata", err.message);
    }
    throw err;
  }
}

// ── Authorization: sign in by emailed code, then consent ───────────

const cookieName = (requestId: string) => `${COOKIE}_${requestId.slice(0, 8)}`;

function setCookie(requestId: string, origin: string): string {
  const secure = origin.startsWith("https://") ? "; Secure" : "";
  return `${cookieName(requestId)}=${requestId}; Path=/oauth; HttpOnly; SameSite=Lax; Max-Age=${TTL.request}${secure}`;
}

const clearCookie = (requestId: string) => `${cookieName(requestId)}=; Path=/oauth; HttpOnly; SameSite=Lax; Max-Age=0`;

function readCookie(req: Request, requestId: string): string | null {
  const name = cookieName(requestId);
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function appName(client: OAuthClient): string {
  if (client.client_name) return client.client_name;
  if (client.kind === "cimd") return new URL(client.client_id).hostname;
  return "An app";
}

const view = (r: AuthRequest, client: OAuthClient): FlowView => ({ requestId: r.id, app: appName(client), returnTo: redirectHost(r.redirect_uri) });

/** Back to the app, with a code or an error (RFC 9207: always the issuer). */
function backTo(redirectUri: string, params: Record<string, string | null>, headers: Record<string, string> = {}): Response {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
  return new Response(null, { status: 303, headers: { Location: u.toString(), "Cache-Control": "no-store", ...headers } });
}

export async function authorizeStart(db: SupabaseClient, req: Request, origin: string): Promise<Response> {
  // Before anything else, including fetching an app's metadata.
  if (await overLimit(db, "authorize", callerKey(req))) {
    return html(errorPage("Too many sign-ins from your network in the last hour. Try again later."), 429, { "Retry-After": "600" });
  }
  const p = new URL(req.url).searchParams;
  const clientId = p.get("client_id");
  if (!clientId) return html(errorPage("The app didn't say who it is (no client_id)."), 400);
  let client: OAuthClient | null;
  try {
    client = await getClient(db, clientId);
  } catch (err) {
    if (err instanceof ClientError) return html(errorPage(err.message), 400);
    throw err;
  }
  if (!client) return html(errorPage("Walkoff doesn't know this app. Remove the connector and add it again."), 400);
  const redirectUri = p.get("redirect_uri") ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : null);
  if (!redirectUri || !redirectAllowed(client.redirect_uris, redirectUri)) {
    return html(errorPage("The app asked to come back to an address it didn't register."), 400);
  }

  // From here on, problems go back to the app.
  const state = p.get("state");
  const fail = (error: string, description: string) => backTo(redirectUri, { error, error_description: description, state, iss: origin });
  if (p.get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  const challenge = p.get("code_challenge");
  if (!challenge || !CHALLENGE.test(challenge) || p.get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const resource = canonicalResource(origin, p.get("resource"));
  if (!resource) return fail("invalid_target", `Walkoff's resource is ${origin}/mcp.`);

  const r = await createRequest(db, { client_id: client.client_id, redirect_uri: redirectUri, state, code_challenge: challenge, resource });
  return html(emailPage(view(r, client)), 200, { "Set-Cookie": setCookie(r.id, origin) });
}

export async function authorizeStep(db: SupabaseClient, req: Request, origin: string): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const id = form?.get("request")?.toString() ?? null;
  const r = form && id ? await loadRequest(db, id) : null;
  if (!form || !r || readCookie(req, r.id) !== r.id) {
    return html(errorPage("This sign-in has expired, or it was opened in another browser."), 400);
  }
  const client = await getClient(db, r.client_id).catch(() => null);
  if (!client) return html(errorPage("Walkoff couldn't load this app's details."), 400);
  const v = view(r, client);

  switch (form.get("step")?.toString()) {
    case "restart": {
      await updateRequest(db, r.id, { email: null, email_code_hash: null, attempts: 0, verified_at: null });
      return html(emailPage(v));
    }

    case "email": {
      const email = (form.get("email")?.toString() ?? "").trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return html(emailPage(v, { error: "That doesn't look like an email address.", email }), 400);
      }
      if (r.codes_sent >= LIMITS.codesSent) return html(errorPage("Too many codes for one sign-in. Start again from Claude."), 429);
      if ((await codesSentTo(db, email)) >= LIMITS.codesPerEmailHour) {
        return html(emailPage(v, { error: "We've sent that address a lot of codes this hour. Try again later.", email }), 429);
      }
      // The same answer whether or not the address has access, so the page
      // can't be used to find out who does. Only invited addresses get mail.
      const access = await accessFor(db, email);
      const invited = access.operator || access.brands.length > 0;
      const code = invited ? sixDigits() : randomToken();
      await updateRequest(db, r.id, { email, email_code_hash: emailCodeHash(r.id, code), codes_sent: r.codes_sent + 1, attempts: 0, verified_at: null });
      let sent: "sent" | "dev" | "none" = "none";
      if (invited) {
        try {
          sent = await sendSignInCode(email, code, v.app);
        } catch (err) {
          console.error("Walkoff sign-in email failed", err);
          return html(emailPage(v, { error: "We couldn't send the email just now. Try again in a minute.", email }), 502);
        }
      }
      return html(codePage(v, email, { devNote: sent === "dev" }));
    }

    case "code": {
      if (!r.email || !r.email_code_hash) return html(emailPage(v));
      if (r.attempts >= LIMITS.attempts) return html(errorPage("Too many wrong codes. Start again from Claude."), 429);
      const code = (form.get("code")?.toString() ?? "").replace(/\D/g, "");
      if (!sameHash(emailCodeHash(r.id, code), r.email_code_hash)) {
        const left = LIMITS.attempts - r.attempts - 1;
        await updateRequest(db, r.id, { attempts: r.attempts + 1 });
        return left > 0
          ? html(codePage(v, r.email, { error: `That code didn't match. ${left} ${left === 1 ? "try" : "tries"} left.` }), 400)
          : html(errorPage("Too many wrong codes. Start again from Claude."), 429);
      }
      await updateRequest(db, r.id, { verified_at: new Date().toISOString(), email_code_hash: null });
      const access = await accessFor(db, r.email);
      return html(consentPage(v, r.email, access.brands, { operator: access.operator }));
    }

    case "consent": {
      if (!r.email || !r.verified_at) return html(emailPage(v));
      if (form.get("decision") !== "allow") {
        await deleteRequest(db, r.id);
        return backTo(r.redirect_uri, { error: "access_denied", error_description: "Access wasn't allowed.", state: r.state, iss: origin }, { "Set-Cookie": clearCookie(r.id) });
      }
      const access = await accessFor(db, r.email);
      const picked = form.getAll("brand").map(String);
      const brandIds = access.operator && picked.includes("all") ? null : access.brands.map((b) => b.id).filter((b) => picked.includes(b));
      if (brandIds !== null && !brandIds.length) {
        return html(consentPage(v, r.email, access.brands, { operator: access.operator, error: "Pick at least one brand." }), 400);
      }
      const code = await issueCode(db, {
        client_id: r.client_id,
        email: r.email,
        brand_ids: brandIds,
        scope: r.scope ?? SCOPE,
        resource: r.resource,
        redirect_uri: r.redirect_uri,
        code_challenge: r.code_challenge,
      });
      await deleteRequest(db, r.id);
      return backTo(r.redirect_uri, { code, state: r.state, iss: origin }, { "Set-Cookie": clearCookie(r.id) });
    }
  }
  return html(errorPage("Something went wrong with this sign-in. Start again from Claude."), 400);
}

// ── Tokens ─────────────────────────────────────────────────────────

async function readParams(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

/** A public client may still send its id with HTTP Basic auth. */
function basicClientId(req: Request): string | undefined {
  const m = req.headers.get("authorization")?.match(/^Basic\s+(\S+)$/i);
  if (!m) return undefined;
  try {
    const decoded = Buffer.from(m[1], "base64").toString("utf8");
    return decodeURIComponent(decoded.split(":")[0] ?? "") || undefined;
  } catch {
    return undefined;
  }
}

export async function token(db: SupabaseClient, req: Request, origin: string): Promise<Response> {
  const p = await readParams(req);
  const clientId = p.client_id ?? basicClientId(req);
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);

  if (p.grant_type === "authorization_code") {
    if (!p.code) return oauthError("invalid_request", "code is required.");
    const g = await spend(db, p.code, "code");
    if (!g || g.client_id !== clientId) return oauthError("invalid_grant", "The code is invalid, expired or already used.");
    if (p.redirect_uri !== undefined && p.redirect_uri !== g.redirect_uri) return oauthError("invalid_grant", "redirect_uri doesn't match the authorization request.");
    if (!g.code_challenge || !pkceMatches(p.code_verifier, g.code_challenge)) return oauthError("invalid_grant", "PKCE verification failed.");
    if (p.resource && canonicalResource(origin, p.resource) !== g.resource) return oauthError("invalid_target", `Walkoff's resource is ${origin}/mcp.`);
    return json(await issueTokens(db, { client_id: g.client_id, email: g.email, brand_ids: g.brand_ids, scope: g.scope, resource: g.resource }));
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required.");
    const g = await spend(db, p.refresh_token, "refresh");
    if (!g || g.client_id !== clientId) return oauthError("invalid_grant", "The refresh token is invalid, expired or already used.");
    if (p.resource && canonicalResource(origin, p.resource) !== g.resource) return oauthError("invalid_target", `Walkoff's resource is ${origin}/mcp.`);
    const brandIds = stillAllowed(g.brand_ids, await accessFor(db, g.email));
    if (brandIds !== null && !brandIds.length) return oauthError("invalid_grant", "This account no longer has Walkoff access.");
    return json(await issueTokens(db, { client_id: g.client_id, email: g.email, brand_ids: brandIds, scope: g.scope, resource: g.resource }));
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

export async function revokeToken(db: SupabaseClient, req: Request): Promise<Response> {
  const p = await readParams(req);
  if (p.token) await revoke(db, p.token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", ...CORS } });
}
