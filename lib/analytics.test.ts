import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstTouch, privatePath, redact, rememberCta, rememberVisit, visitAttribution } from "./analytics";

const page = (url: string) => ({ type: "pageview" as const, url });

describe("analytics", () => {
  it("never sends a brand's upload token", () => {
    assert.equal(redact(page("https://www.walkoff.io/upload/0f3a9c71e2"))?.url, "https://www.walkoff.io/upload/[token]");
    assert.equal(redact(page("https://www.walkoff.io/upload/0f3a9c71e2/?x=1#map"))?.url, "https://www.walkoff.io/upload/[token]/#map");
    assert.equal(privatePath("/upload/demox"), "/upload/[token]");
    assert.equal(privatePath("/api/upload/0f3a9c71e2/customers"), "/api/upload/0f3a9c71e2/customers");
  });

  it("keeps the public demo's address", () => {
    assert.equal(redact(page("https://www.walkoff.io/upload/demo"))?.url, "https://www.walkoff.io/upload/demo");
  });

  it("never sends a pitch's token, here or with an early access request", () => {
    assert.equal(redact(page("https://www.walkoff.io/p/Xq2v9LmB0aT7kP3sW8yZcD1e?preview=1"))?.url, "https://www.walkoff.io/p/[token]");
    assert.equal(firstTouch("https://www.walkoff.io/p/Xq2v9LmB0aT7kP3sW8yZcD1e", "").landing_path, "/p/[token]");
    assert.equal(privatePath("/p/demo"), "/p/demo");
    assert.equal(privatePath("/pricing"), "/pricing");
  });

  it("drops sign-in pages", () => {
    assert.equal(redact(page("https://www.walkoff.io/oauth/authorize?client_id=x&state=y")), null);
    assert.equal(redact(page("not a url")), null);
  });

  it("keeps campaign tags and ref, and nothing else in the query", () => {
    const sent = redact(page("https://www.walkoff.io/?utm_source=linkedin&utm_campaign=fall&fbclid=abc&email=a%40b.co&ref=hn#form"));
    assert.equal(sent?.url, "https://www.walkoff.io/?utm_source=linkedin&utm_campaign=fall&ref=hn#form");
    assert.equal(redact(page("https://www.walkoff.io/?utm_content=sam%40brand.com"))?.url, "https://www.walkoff.io/");
  });

  it("keeps the event's other fields", () => {
    assert.deepEqual(redact({ type: "event" as const, url: "https://www.walkoff.io/pricing" }), { type: "event", url: "https://www.walkoff.io/pricing" });
  });

  it("records where a visit came from: campaign tags, the referring host and the landing page", () => {
    assert.deepEqual(
      firstTouch("https://www.walkoff.io/help/klaviyo?utm_source=linkedin&utm_medium=social&utm_campaign=%20fall%20&gclid=x", "https://www.linkedin.com/feed/update/123"),
      { landing_path: "/help/klaviyo", utm_source: "linkedin", utm_medium: "social", utm_campaign: "fall", referrer: "www.linkedin.com" },
    );
    assert.deepEqual(firstTouch("https://www.walkoff.io/", ""), { landing_path: "/" });
    assert.deepEqual(firstTouch("https://www.walkoff.io/", "https://www.walkoff.io/help"), { landing_path: "/" });
    assert.deepEqual(firstTouch("https://www.walkoff.io/upload/0f3a9c71e2?utm_term=a%40b.co", ""), { landing_path: "/upload/[token]" });
  });

  it("keeps the first page of a visit and the last button clicked", () => {
    rememberVisit("https://www.walkoff.io/?utm_source=newsletter", "");
    rememberVisit("https://www.walkoff.io/pricing", "https://www.google.com/");
    rememberCta("hero");
    rememberCta("pricing");
    assert.deepEqual(visitAttribution(), { landing_path: "/", utm_source: "newsletter", cta_placement: "pricing" });
  });
});
