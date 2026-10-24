// Setting a brand up from Claude: the catalog from the store's public feed,
// customer counts from Shopify's analytics, no files.
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { POSTAL_AREAS } from "../affinity/geo";
import { customerCountsImport, SHOPIFY_TOOLS, SHOPIFYQL } from "../affinity/shopify-counts";
import { fakeDb, type Tables } from "../testing/fake-db";
import { fakeStorefront, feedProduct } from "../testing/fake-store";
import type { Principal } from "./data";
import { createWalkoffServer } from "./server";
import type { ToolContext } from "./tools";

process.env.WALKOFF_OPERATOR_EMAILS = "op@walkoff.io";

const ORIGIN = "https://www.walkoff.io";
const NOW = new Date("2026-10-24T12:00:00Z");
const FROST = "7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10";
const SUNDAY = "0b9e8d7c-2222-4c8a-9a51-0d6c3b0e8f10";
const HOST = "shop.example.com";

const jane: Principal = { email: "jane@frostbuddy.com", brandIds: [FROST], clientId: "claude", scope: "walkoff" };
const operator: Principal = { email: "op@walkoff.io", brandIds: null, clientId: "claude", scope: "walkoff" };

const brand = (id: string, name: string, store: string | null) => ({
  id,
  name,
  upload_token: `${name.replace(/\W/g, "")}-token-0123456789`,
  store_url: store,
  licensed: false,
  contact_email: null,
  created_at: "2026-10-01T00:00:00Z",
});

const seeded = (tables: Tables = {}) =>
  fakeDb({ brands: [brand(FROST, "Frost Buddy", `https://${HOST}`), brand(SUNDAY, "Sunday Supply", "https://sunday.example.com")], ...tables });

async function connect(ctx: Partial<ToolContext> & Pick<ToolContext, "db" | "principal">): Promise<Client> {
  const server = createWalkoffServer({ now: () => NOW, origin: ORIGIN, ...ctx });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { isError: r.isError === true, text, json: () => JSON.parse(text) };
}

const products = (n: number) => Array.from({ length: n }, (_, i) => feedProduct(i + 1, i % 3 ? {} : { colors: ["Midnight Green", "Silver"] }));

/** The two queries' rows for a store in San Diego, Philadelphia, Toronto
 *  and London, as full postal codes. */
function shopifyRows() {
  const areas = (country: string, region: string, n: number) =>
    POSTAL_AREAS.filter((a) => a.country === country && a.region === region)
      .sort((a, b) => b.population - a.population)
      .slice(0, n);
  const placed = [
    ...areas("US", "CA", 20).map((a, i) => [a.country, a.ref, 60 - i] as const),
    ...areas("US", "PA", 8).map((a, i) => [a.country, a.ref, 30 - i] as const),
    ...areas("CA", "ON", 3).map((a) => [a.country, a.ref, 12] as const),
    ...areas("GB", "ENG", 2).map((a) => [a.country, a.ref, 9] as const),
  ];
  const postal = ["shipping_country_code,shipping_postal_code,customers", ...placed.map((r) => r.join(","))].join("\n");
  const regions = "shipping_country_code,shipping_region,customers\nUS,California,2400\nUS,Pennsylvania,500\nCA,Ontario,60\nGB,,40\nUS,Armed Forces Europe,6";
  return { postal, regions, codes: placed.map((r) => r[1]) };
}

describe("setting up in Claude", () => {
  it("gives members the setup tools, marked as they are, and the prompt", async () => {
    const client = await connect({ db: seeded(), principal: jane });
    const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    assert.equal(tools.get("import_catalog")?.title, "Import the catalog from the store");
    assert.equal(tools.get("import_customer_counts")?.title, "Import customer counts from Shopify");
    assert.deepEqual(tools.get("import_catalog")?.annotations, {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    assert.deepEqual(tools.get("import_customer_counts")?.annotations, {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });

    const prompts = (await client.listPrompts()).prompts;
    assert.ok(prompts.some((p) => p.name === "set_up_brand" && p.title === "Set up from Shopify"));
    const prompt = await client.getPrompt({ name: "set_up_brand", arguments: { brand: "Frost Buddy" } });
    const text = prompt.messages.map((m) => (m.content.type === "text" ? m.content.text : "")).join("\n");
    const instructions = client.getInstructions() ?? "";
    for (const said of [text, instructions]) {
      for (const q of Object.values(SHOPIFYQL)) assert.ok(said.includes(q), "the exact query");
      for (const tool of ["import_catalog", "import_customer_counts", "get_affinity_map", SHOPIFY_TOOLS.analytics]) assert.ok(said.includes(tool), tool);
      assert.match(said, /Counts only/);
    }
    assert.match(text, /^Set up Walkoff for Frost Buddy from our Shopify store\./);
    assert.ok(instructions.includes(`${ORIGIN}/help/shopify`));
    assert.ok(!instructions.includes("create_brand"), "members don't see the operator steps");
    await client.close();
  });

  it("says what each brand still needs, and points to setup", async () => {
    const client = await connect({ db: seeded(), principal: jane });
    const listed = (await call(client, "list_brands")).json();
    assert.deepEqual(listed.brands[0].setup_needed, ["catalog", "customer counts"]);
    assert.match(listed.next, /^Set up Frost Buddy first, with the Setup steps: import_catalog, Walkoff's two Shopify queries, then import_customer_counts\./);
    const map = await call(client, "get_affinity_map");
    assert.ok(map.isError);
    assert.match(map.text, /^Frost Buddy has no fan map yet: it needs its customer counts\./);
    assert.ok(map.text.includes(`${ORIGIN}/help/shopify#customers`));
    const moments = await call(client, "recent_moments");
    assert.match(moments.text, /^Frost Buddy has no fan map yet, so it has no standout teams\. Set it up first, or name a team\.$/);
    const picks = (await call(client, "match_products", { team: "Eagles" })).json();
    assert.match(picks.note, /^No catalog yet: import_catalog reads it from the store\./);
    await client.close();
  });
});

describe("import_catalog", () => {
  it("reads the store's public feed and saves its products", async () => {
    const db = seeded();
    const store = fakeStorefront({ host: HOST, products: products(260) });
    const client = await connect({ db, principal: jane, fetch: store.fetch, lookup: store.lookup });

    const r = await call(client, "import_catalog");
    assert.ok(!r.isError, r.text);
    const out = r.json();
    assert.deepEqual(
      [out.brand, out.store, out.products_read, out.pages, out.complete, out.catalog.products, out.map_refreshed],
      ["Frost Buddy", `https://${HOST}`, 260, 2, true, 260, false],
    );
    assert.equal(out.examples.length, 3);
    assert.match(out.next, /^Next: customer counts\./);
    assert.equal(db.tables.brand_products.length, 260);
    assert.ok(db.tables.brand_products.every((p) => p.brand_id === FROST && p.tagged_by === "rules"));
    const green = db.tables.brand_products.find((p) => p.handle === "product-1")!;
    assert.deepEqual((green.colorways as { name: string }[]).map((c) => c.name), ["Midnight Green", "Silver"]);
    assert.deepEqual(db.tables.brand_uploads.map((u) => [u.format, u.rows_read]), [["shopify_store", 260]]);
    assert.ok(store.requests.every((u) => u.startsWith(`https://${HOST}/products.json?limit=250&page=`)));

    // Again, once Claude has tagged a product: its tags stay.
    green.tagged_by = "claude";
    assert.ok(!(await call(client, "import_catalog")).isError);
    assert.equal(db.tables.brand_products.length, 260);
    assert.equal(db.tables.brand_products.find((p) => p.handle === "product-1")!.tagged_by, "claude");
    assert.equal(db.tables.brand_uploads.length, 2);
    await client.close();
  });

  it("says plainly when the store can't be read, and saves nothing", async () => {
    const db = seeded();
    const cases = [
      [fakeStorefront({ host: HOST, products: [], status: 404 }), /^shop\.example\.com doesn't have a Shopify product feed, so it may not be a Shopify store\./],
      [fakeStorefront({ host: HOST, products: products(3), password: true }), /^shop\.example\.com is password protected, so its products aren't public yet\./],
      [fakeStorefront({ host: HOST, products: products(3), addresses: { [HOST]: ["10.0.0.5"] } }), /^Walkoff can only read stores on the public internet/],
    ] as const;
    for (const [store, message] of cases) {
      const client = await connect({ db, principal: jane, fetch: store.fetch, lookup: store.lookup });
      const r = await call(client, "import_catalog");
      assert.ok(r.isError, r.text);
      assert.match(r.text, message);
      assert.ok(r.text.endsWith(`Not on Shopify? Upload a product export with the link in your welcome email: ${ORIGIN}/help/uploads#export`), r.text);
      await client.close();
    }
    assert.deepEqual([db.tables.brand_products ?? [], db.tables.brand_uploads ?? []], [[], []]);

    const noStore = fakeDb({ brands: [brand(FROST, "Frost Buddy", null)] });
    const client = await connect({ db: noStore, principal: jane, fetch: cases[0][0].fetch, lookup: cases[0][0].lookup });
    const r = await call(client, "import_catalog");
    assert.match(r.text, /^Walkoff doesn't have Frost Buddy's store address yet\. Ask your Walkoff contact to add it\./);
    await client.close();
  });

  it("reads only the member's own brands", async () => {
    const store = fakeStorefront({ host: "sunday.example.com", products: products(3) });
    const client = await connect({ db: seeded(), principal: jane, fetch: store.fetch, lookup: store.lookup });
    const r = await call(client, "import_catalog", { brand: "Sunday Supply" });
    assert.ok(r.isError);
    assert.match(r.text, /^No brand matches "Sunday Supply"\. You have Frost Buddy\./);
    assert.deepEqual(store.requests, []);
    await client.close();

    const asOperator = await connect({ db: seeded(), principal: operator, fetch: store.fetch, lookup: store.lookup });
    assert.ok(!(await call(asOperator, "import_catalog", { brand: "Sunday Supply" })).isError, "operators can set any brand up");
    await asOperator.close();
  });
});

describe("import_customer_counts", () => {
  it("maps the counts and keeps only areas", async () => {
    const db = seeded({
      brand_product_counts: [{ brand_id: FROST, country: "US", area: "921", product: "Bolt Hoodie", orders: 4, revenue: 200 }],
    });
    const client = await connect({ db, principal: jane });
    const { postal, regions, codes } = shopifyRows();
    const r = await call(client, "import_customer_counts", { postal_codes: postal, regions });
    assert.ok(!r.isError, r.text);
    const out = r.json();
    const want = customerCountsImport({ postalCodes: postal, regions });
    assert.equal(out.customers_mapped, want.build.customers);
    assert.equal(out.customers_mapped, 2400 + 500 + 60 + 40 + 6);
    assert.equal(out.placed_by_postal_code, want.build.fromPostalCodes);
    assert.deepEqual(out.not_placed, { other_countries: 0, unknown_postal_codes: 0, unreadable_rows: 0 });
    assert.deepEqual(out.regions_not_matched, ["Armed Forces Europe"]);
    assert.match(out.kept, /^Customers per area only/);

    const stored = db.tables.brand_area_counts;
    assert.deepEqual(
      stored.map((a) => [a.country, a.area, a.customers]),
      want.upload.areas.map((a) => [a.country, a.area, a.customers]),
    );
    assert.ok(stored.every((a) => a.brand_id === FROST && /^(\d{3}|[A-Z]\d[A-Z]|[A-Z]{1,2}\d[A-Z\d]?)$/.test(String(a.area))));
    const everything = JSON.stringify(db.tables);
    for (const code of codes) assert.ok(!everything.includes(`"${code}"`), `${code} was stored`);
    assert.deepEqual(db.tables.brand_uploads.map((u) => [u.format, u.customers]), [["shopify_analytics", out.customers_mapped]]);
    assert.equal(db.tables.affinity_reports.length, 1);
    assert.equal(db.tables.brand_product_counts.length, 1, "an earlier orders upload's products stay");

    const listed = (await call(client, "list_brands")).json();
    assert.deepEqual(listed.brands[0].setup_needed, ["catalog"]);
    assert.equal(listed.brands[0].customers_mapped, out.customers_mapped);
    await client.close();
  });

  it("refuses rows with more than counts, and saves nothing", async () => {
    const db = seeded({ brand_area_counts: [{ brand_id: FROST, country: "US", area: "921", customers: 40, orders: 0, revenue: 0 }] });
    const client = await connect({ db, principal: jane });
    const refusals = [
      [{ postal_codes: "US,92108,37\nUS,jane@frostbuddy.com,1" }, /email address/],
      [{ postal_codes: "US,92108,37\nJane Doe,1 Main St,San Diego,92108,1" }, /^Line 2 of postal_codes has more than three parts\./],
      [{ postal_codes: "US,California,1204", regions: "US,92108,37" }, /^The rows look swapped\./],
      [{ postal_codes: "FR,75001,9" }, /^None of these postal codes are in an area Walkoff maps/],
    ] as const;
    for (const [args, message] of refusals) {
      const r = await call(client, "import_customer_counts", args);
      assert.ok(r.isError, r.text);
      assert.match(r.text, message);
      assert.doesNotMatch(r.text, /Jane|Main St|92108|75001/, "never echoes a row");
    }
    assert.deepEqual(db.tables.brand_area_counts.map((a) => a.customers), [40]);
    assert.equal(db.tables.brand_uploads, undefined);

    const other = await call(client, "import_customer_counts", { brand: SUNDAY, postal_codes: "US,92108,37" });
    assert.match(other.text, /^No brand matches/);
    await client.close();
  });
});
