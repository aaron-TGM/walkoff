import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appName, isMetadataUrl, privateAddress, readMetadataDocument, redirectAllowed, redirectHost, validRedirectUri, type OAuthClient } from "./clients";
import { fakeDb } from "../../testing/fake-db";
import { authorizationServerMetadata, canonicalResource, LIMITS, protectedResourceMetadata } from "./config";
import { pkceMatches } from "./crypto";
import { authorizeStart, authorizeStep } from "./handlers";
import { overLimit, RATE } from "./limits";
import { stillAllowed } from "./store";

const ORIGIN = "https://www.walkoff.io";

describe("redirect addresses", () => {
  it("allows https, http on this machine, and reverse-domain app schemes", () => {
    assert.ok(validRedirectUri("https://claude.ai/api/mcp/auth_callback"));
    assert.ok(validRedirectUri("http://localhost:33418/callback"));
    assert.ok(validRedirectUri("http://127.0.0.1/callback"));
    assert.ok(validRedirectUri("com.example.app:/oauth"));
    assert.ok(!validRedirectUri("http://example.com/callback"));
    assert.ok(!validRedirectUri("https://claude.ai/cb#frag"));
    assert.ok(!validRedirectUri("javascript:alert(1)"));
    assert.ok(!validRedirectUri("not a url"));
  });

  it("matches exactly, except loopback ports", () => {
    const claude = ["https://claude.ai/api/mcp/auth_callback"];
    assert.ok(redirectAllowed(claude, "https://claude.ai/api/mcp/auth_callback"));
    assert.ok(!redirectAllowed(claude, "https://claude.ai/api/mcp/auth_callback/other"));
    assert.ok(!redirectAllowed(claude, "https://evil.example/api/mcp/auth_callback"));
    const code = ["http://localhost/callback", "http://127.0.0.1/callback"];
    assert.ok(redirectAllowed(code, "http://localhost:54123/callback"));
    assert.ok(redirectAllowed(code, "http://127.0.0.1:8080/callback"));
    assert.ok(!redirectAllowed(code, "http://localhost:54123/other"));
    assert.ok(!redirectAllowed(code, "http://127.0.0.2:8080/callback"));
  });

  it("names where the person goes back to", () => {
    assert.equal(redirectHost("https://claude.ai/api/mcp/auth_callback"), "claude.ai");
    assert.equal(redirectHost("http://localhost:54123/callback"), "localhost:54123");
    assert.equal(redirectHost("com.example.app:/oauth"), "com.example.app");
  });

  it("calls an app by its own name only when it comes back to Claude or this device", () => {
    const claude = (redirect: string, kind: OAuthClient["kind"] = "dcr"): [OAuthClient, string] => [
      { client_id: "https://evil.example/c.json", client_name: "Claude", redirect_uris: [redirect], kind },
      redirect,
    ];
    assert.equal(appName(...claude("https://claude.ai/api/mcp/auth_callback", "cimd")), "Claude");
    assert.equal(appName(...claude("https://app.claude.com/callback")), "Claude");
    assert.equal(appName(...claude("http://localhost:54123/callback")), "Claude");
    assert.equal(appName(...claude("com.example.app:/oauth")), "Claude");
    assert.equal(appName(...claude("https://evil.example/cb", "cimd")), "evil.example");
    assert.equal(appName(...claude("https://claude.ai.evil.example/cb")), "claude.ai.evil.example");
    assert.equal(appName(...claude("https://evilclaude.ai/cb")), "evilclaude.ai");
    const unnamed: OAuthClient = { client_id: "wo_client_x", client_name: null, redirect_uris: [], kind: "dcr" };
    assert.equal(appName(unnamed, "http://localhost/callback"), "An app");
  });
});

describe("client ID metadata documents", () => {
  const id = "https://claude.ai/oauth/claude-code-client-metadata";

  it("only fetches public https URLs with a path", () => {
    assert.ok(isMetadataUrl(id));
    assert.ok(!isMetadataUrl("http://claude.ai/oauth/metadata"));
    assert.ok(!isMetadataUrl("https://claude.ai/"));
    assert.ok(!isMetadataUrl("https://127.0.0.1/metadata"));
    assert.ok(!isMetadataUrl("https://localhost/metadata"));
    assert.ok(!isMetadataUrl("https://[::1]/metadata"));
    assert.ok(!isMetadataUrl("https://metadata.internal/x"));
    assert.ok(!isMetadataUrl("wo_client_abc"));
  });

  it("won't fetch from an address on a private network", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      assert.ok(privateAddress(ip), ip);
    }
    for (const ip of ["160.79.104.10", "104.20.23.154", "172.66.147.243", "8.8.8.8", "2606:4700::1111"]) {
      assert.ok(!privateAddress(ip), ip);
    }
  });

  it("checks the document names itself and lists usable redirects", () => {
    const doc = { client_id: id, client_name: "Claude Code", redirect_uris: ["http://localhost/callback"], token_endpoint_auth_method: "none" };
    assert.deepEqual(readMetadataDocument(id, doc), { client_id: id, client_name: "Claude Code", redirect_uris: ["http://localhost/callback"] });
    assert.throws(() => readMetadataDocument(id, { ...doc, client_id: "https://other.example/doc" }), /different client_id/);
    assert.throws(() => readMetadataDocument(id, { ...doc, redirect_uris: [] }), /redirect_uris/);
    assert.throws(() => readMetadataDocument(id, { ...doc, redirect_uris: ["http://evil.example/cb"] }), /redirect_uris/);
    assert.throws(() => readMetadataDocument(id, { ...doc, token_endpoint_auth_method: "private_key_jwt" }), /public apps/);
    assert.throws(() => readMetadataDocument(id, "nope"), /JSON object/);
  });
});

describe("PKCE", () => {
  it("verifies S256 (RFC 7636 appendix B)", () => {
    assert.ok(pkceMatches("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"));
    assert.ok(!pkceMatches("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXK", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"));
    assert.ok(!pkceMatches("short", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"));
    assert.ok(!pkceMatches(undefined, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"));
  });
});

describe("metadata", () => {
  it("binds tokens to the /mcp resource", () => {
    assert.equal(canonicalResource(ORIGIN, null), `${ORIGIN}/mcp`);
    assert.equal(canonicalResource(ORIGIN, `${ORIGIN}/mcp/`), `${ORIGIN}/mcp`);
    assert.equal(canonicalResource(ORIGIN, "https://walkoff.io/mcp"), null);
    assert.equal(canonicalResource(ORIGIN, "https://evil.example/mcp"), null);
  });

  it("advertises what Claude's connector looks for", () => {
    const prm = protectedResourceMetadata(ORIGIN);
    assert.equal(prm.resource, `${ORIGIN}/mcp`);
    assert.deepEqual(prm.authorization_servers, [ORIGIN]);
    const as = authorizationServerMetadata(ORIGIN);
    assert.equal(as.issuer, ORIGIN);
    assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
    assert.ok(as.client_id_metadata_document_supported);
    assert.ok(as.token_endpoint_auth_methods_supported.includes("none"));
    assert.ok(as.authorization_response_iss_parameter_supported);
    assert.equal(as.registration_endpoint, `${ORIGIN}/oauth/register`);
  });
});

describe("stillAllowed", () => {
  const access = (operator: boolean, ids: string[]) => ({ operator, brands: ids.map((id) => ({ id, name: id })) });

  it("keeps only brands the person can still use", () => {
    assert.deepEqual(stillAllowed(["a", "b"], access(false, ["b", "c"])), ["b"]);
    assert.deepEqual(stillAllowed(["a"], access(false, [])), []);
    assert.equal(stillAllowed(null, access(true, ["a"])), null);
    assert.deepEqual(stillAllowed(null, access(false, ["a"])), ["a"], "an operator who stopped being one keeps only invited brands");
    assert.deepEqual(stillAllowed(["a", "z"], access(true, ["a"])), ["a", "z"]);
  });
});

describe("sign-in limits per address", () => {
  const callback = "https://claude.ai/api/mcp/auth_callback";
  const email = "someone@frostbuddy.com";
  const db = () =>
    fakeDb({ oauth_clients: [{ client_id: "wo_client_test", client_name: "Claude", redirect_uris: [callback], kind: "dcr", fetched_at: new Date().toISOString() }] });

  /** Starts a sign-in, and returns a way to post its steps. */
  async function signIn(d: ReturnType<typeof db>) {
    const q = new URLSearchParams({ client_id: "wo_client_test", redirect_uri: callback, response_type: "code", code_challenge: "a".repeat(43), code_challenge_method: "S256" });
    const res = await authorizeStart(d, new Request(`${ORIGIN}/oauth/authorize?${q}`), ORIGIN);
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const request = cookie.split("=")[1];
    return (fields: Record<string, string>) =>
      authorizeStep(d, new Request(`${ORIGIN}/oauth/authorize`, { method: "POST", body: new URLSearchParams({ request, ...fields }), headers: { cookie } }), ORIGIN);
  }

  it("caps the codes sent to an address, however often sign-ins start over", async () => {
    const d = db();
    let sent = 0;
    while (sent < LIMITS.codesPerEmailHour) {
      const step = await signIn(d);
      for (let i = 0; i < LIMITS.codesSent && sent < LIMITS.codesPerEmailHour; i++, sent++) {
        assert.equal((await step({ step: "email", email })).status, 200);
        await step({ step: "restart" });
      }
    }
    const step = await signIn(d);
    assert.equal((await step({ step: "email", email })).status, 429);
    assert.equal((await step({ step: "email", email: "other@frostbuddy.com" })).status, 200, "other addresses are fine");
  });

  it("caps wrong codes for an address across sign-ins", async () => {
    const d = db();
    let wrong = 0;
    while (wrong < LIMITS.wrongCodesPerEmailHour) {
      const step = await signIn(d);
      await step({ step: "email", email });
      for (let i = 0; i < LIMITS.attempts && wrong < LIMITS.wrongCodesPerEmailHour; i++, wrong++) await step({ step: "code", code: "000000" });
    }
    const step = await signIn(d);
    assert.equal((await step({ step: "email", email })).status, 200);
    const res = await step({ step: "code", code: "000000" });
    assert.equal(res.status, 429);
    assert.match(await res.text(), /Too many wrong codes for this address/);
  });
});

describe("early access requests", () => {
  it("are capped per caller", async () => {
    const d = fakeDb();
    for (let i = 0; i < RATE.waitlist.perCaller; i++) assert.equal(await overLimit(d, "waitlist", "caller-a"), false);
    assert.equal(await overLimit(d, "waitlist", "caller-a"), true);
    assert.equal(await overLimit(d, "waitlist", "caller-b"), false);
  });
});
