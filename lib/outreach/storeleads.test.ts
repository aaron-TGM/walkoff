import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseProspects, readCsv } from "./csv";
import { countMatches, keep, pageUrl, pullDomains, searchParams, SEPARATOR, toCsv, toRow, type Domain, type Fetch, type Page } from "./storeleads";

// A Domain as List Domains returns it (docs: storeleads.app/api), trimmed
// to the fields the pull asks for.
const FROST: Domain = {
  name: "www.frostbuddy.com",
  merchant_name: "Frost Buddy",
  platform: "shopify",
  country_code: "US",
  administrative_area_level_1: "California",
  city: "San Clemente",
  latitude: 33.4269728,
  longitude: -117.6119925,
  estimated_sales: 12_345_678, // cents
  product_count: 312,
  categories: ["/Home & Garden/Kitchen & Dining", "/Sports/Sporting Goods/Outdoors"],
  apps: [{ name: "Klaviyo: Email Marketing & SMS" }, { name: "Postscript SMS Marketing" }],
  cluster_domains: ["www.frostbuddy.com", "frostbuddy.ca"],
  rank: 41_200,
};

describe("searchParams", () => {
  it("is the search docs/storeleads.md describes, money in cents", () => {
    const p = searchParams();
    assert.equal(p["f:p"], "shopify");
    assert.equal(p["f:cc"], "US");
    assert.equal(p["f:ds"], "Active");
    assert.equal(p["f:an"], "shopify.klaviyo-email-marketing");
    assert.equal(p["f:cat:op"], "or");
    assert.ok(p["f:cat"].split(",").includes("/Apparel/Athletic Apparel"));
    assert.ok(p["f:cat"].split(",").includes("/Home & Garden/Kitchen & Dining"));
    assert.equal(p["f:ermin"], "2500000");
    assert.equal(p["f:ermax"], "100000000");
    assert.equal(p["f:ismy"], "false");
    assert.equal(p["f:tags:op"], "not");
  });

  it("asks for no contact details", () => {
    const url = pageUrl({ pageSize: 10 });
    assert.doesNotMatch(new URL(url).searchParams.get("fields")!, /contact|email|phone/);
  });

  it("pulls a saved list instead of the search when given one", () => {
    const params = new URL(pageUrl({ list: "123", pageSize: 10, cursor: "abc" })).searchParams;
    assert.equal(params.get("f:lids"), "123");
    assert.equal(params.get("f:cc"), null);
    assert.equal(params.get("cursor"), "abc");
  });
});

describe("toRow", () => {
  it("writes dollars, the state from administrative_area_level_1, and joins lists", () => {
    const row = toRow({ ...FROST, apps: [{ name: "Odd | App" }, {}] });
    assert.equal(row["Estimated Monthly Sales"], "123456.78");
    assert.equal(row.State, "California");
    assert.equal(row.Categories, `/Home & Garden/Kitchen & Dining${SEPARATOR}/Sports/Sporting Goods/Outdoors`);
    assert.equal(row.Apps, "Odd / App");
  });

  it("leaves unknowns blank", () => {
    const row = toRow({ name: "a.com" });
    assert.equal(row["Estimated Monthly Sales"], "");
    assert.equal(row.Latitude, "");
  });
});

describe("keep", () => {
  it("keeps one domain per merchant, US stores, and founder-sized teams", () => {
    const { domains, dropped } = keep([
      FROST,
      { ...FROST, name: "frostbuddy.ca", country_code: "US" },
      { name: "big.com", country_code: "US", employee_count: 900 },
      { name: "maple.ca", country_code: "CA" },
      { name: "unknown-size.com", country_code: "US" },
      { merchant_name: "No domain" },
    ]);
    assert.deepEqual(
      domains.map((d) => d.name),
      ["www.frostbuddy.com", "unknown-size.com"],
    );
    assert.deepEqual(dropped, {
      "same merchant's other domain": 1,
      "more than 200 employees": 1,
      "not in the US": 1,
      "no domain": 1,
    });
  });
});

describe("toCsv", () => {
  it("writes a file the importer reads, every field from its own column", () => {
    const { headers, rows } = readCsv(toCsv([FROST]));
    const { prospects, report } = parseProspects(headers, rows, { separator: SEPARATOR });
    assert.deepEqual(report.columns.domain, ["Domain"]);
    assert.deepEqual(report.columns.region, ["State"]);
    assert.deepEqual(report.columns.monthly_sales, ["Estimated Monthly Sales"]);
    assert.deepEqual(prospects, [
      {
        domain: "frostbuddy.com",
        name: "Frost Buddy",
        store_url: "https://frostbuddy.com",
        platform: "shopify",
        country: "US",
        city: "San Clemente",
        region: "CA",
        postal_code: null,
        lat: 33.4269728,
        lng: -117.6119925,
        monthly_sales: 123456.78,
        product_count: 312,
        categories: ["/Home & Garden/Kitchen & Dining", "/Sports/Sporting Goods/Outdoors"],
        apps: ["Klaviyo: Email Marketing & SMS", "Postscript SMS Marketing"],
      },
    ]);
  });
});

// ── The API ─────────────────────────────────────────────────────────

function fakeApi(pages: (Page | { status: number; retryAfter?: string })[]) {
  const calls: { url: string; auth?: string }[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, auth: init?.headers?.Authorization });
    const next = pages.shift();
    if (!next) throw new Error("no more pages");
    if ("status" in next) {
      return new Response("slow down", { status: next.status, headers: next.retryAfter ? { "Retry-After": next.retryAfter } : {} });
    }
    return Response.json(next);
  };
  return { fetch, calls };
}

describe("pullDomains", () => {
  it("follows the cursor to the end, with the key", async () => {
    const api = fakeApi([
      { domains: [{ name: "a.com" }, { name: "b.com" }], has_next_page: true, next_cursor: "c1", total: 3 },
      { domains: [{ name: "c.com" }], has_next_page: false, total: 3 },
    ]);
    const sleeps: number[] = [];
    const out = await pullDomains({ key: "k", pageSize: 2, fetch: api.fetch, sleep: async (ms) => void sleeps.push(ms) });
    assert.deepEqual(out.domains.map((d) => d.name), ["a.com", "b.com", "c.com"]);
    assert.equal(out.total, 3);
    assert.equal(api.calls[0].auth, "Bearer k");
    assert.equal(new URL(api.calls[1].url).searchParams.get("cursor"), "c1");
    assert.deepEqual(sleeps, [600]);
  });

  it("stops at max", async () => {
    const api = fakeApi([{ domains: [{ name: "a.com" }, { name: "b.com" }], has_next_page: true, next_cursor: "c1", total: 9 }]);
    const out = await pullDomains({ key: "k", max: 2, fetch: api.fetch, sleep: async () => {} });
    assert.equal(out.domains.length, 2);
    assert.equal(api.calls.length, 1);
    assert.equal(new URL(api.calls[0].url).searchParams.get("page_size"), "2");
  });

  it("waits out a 429 as Retry-After says", async () => {
    const api = fakeApi([{ status: 429, retryAfter: "3" }, { domains: [{ name: "a.com" }], has_next_page: false }]);
    const sleeps: number[] = [];
    const out = await pullDomains({ key: "k", fetch: api.fetch, sleep: async (ms) => void sleeps.push(ms) });
    assert.equal(out.domains.length, 1);
    assert.deepEqual(sleeps, [3000]);
  });

  it("says why when the key or plan is refused", async () => {
    await assert.rejects(pullDomains({ key: "bad", fetch: fakeApi([{ status: 401 }]).fetch }), /key was refused/);
    await assert.rejects(pullDomains({ key: "k", fetch: fakeApi([{ status: 403 }]).fetch }), /Pro or higher/);
  });
});

describe("countMatches", () => {
  it("reads the total from a one-store page", async () => {
    const api = fakeApi([{ domains: [{ name: "a.com" }], total: 14_210 }]);
    assert.equal(await countMatches({ key: "k", fetch: api.fetch }), 14_210);
    assert.equal(new URL(api.calls[0].url).searchParams.get("page_size"), "1");
  });
});
