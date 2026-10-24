import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { feedProduct, fakeStorefront } from "../testing/fake-store";
import { parseCatalog, type Row } from "./imports";
import { fetchStorefrontCatalog, productsJsonToRows, STOREFRONT, StorefrontError, type FeedProduct } from "./storefront";

const HOST = "shop.example.com";
const STORE = `https://${HOST}`;
const noWait = async () => {};

const products = (n: number) => Array.from({ length: n }, (_, i) => feedProduct(i + 1));

async function fails(p: Promise<unknown>, message: RegExp) {
  await assert.rejects(p, (err: unknown) => err instanceof StorefrontError && message.test(err.message));
}

describe("productsJsonToRows", () => {
  it("reads a feed product exactly as the same product in an export", () => {
    const feed: FeedProduct = {
      id: 7,
      handle: "jogger",
      title: "Everyday Jogger",
      body_html: "<p>Soft <b>fleece</b>.</p>",
      product_type: "Pants",
      tags: ["fleece", "fall"],
      options: [{ name: "Size", position: 1 }, { name: "Color", position: 2 }],
      variants: [
        { sku: "EJ-AZ-S", price: "68.00", option1: "S", option2: "Azure Heather", featured_image: { src: "https://cdn.example.com/az.jpg" } },
        { sku: "EJ-AZ-M", price: "68.00", option1: "M", option2: "Azure Heather", featured_image: null },
        { sku: "EJ-SF-S", price: "64.00", option1: "S", option2: "Sunflower", featured_image: null },
      ],
      images: [{ src: "https://cdn.example.com/main.jpg" }],
    };
    const exported: Row[] = [
      { Handle: "jogger", Title: "Everyday Jogger", "Body (HTML)": "<p>Soft <b>fleece</b>.</p>", Type: "Pants", Tags: "fleece, fall", "Option1 Name": "Size", "Option1 Value": "S", "Option2 Name": "Color", "Option2 Value": "Azure Heather", "Variant SKU": "EJ-AZ-S", "Variant Price": "68.00", "Variant Image": "https://cdn.example.com/az.jpg", "Image Src": "https://cdn.example.com/main.jpg" },
      { Handle: "jogger", "Option1 Value": "M", "Option2 Value": "Azure Heather", "Variant SKU": "EJ-AZ-M", "Variant Price": "68.00" },
      { Handle: "jogger", "Option1 Value": "S", "Option2 Value": "Sunflower", "Variant SKU": "EJ-SF-S", "Variant Price": "64.00" },
    ];
    const fromFeed = parseCatalog("shopify_products", productsJsonToRows([feed]));
    assert.deepEqual(fromFeed, parseCatalog("shopify_products", exported));
    assert.deepEqual(fromFeed[0].colorways, [
      { name: "Azure Heather", skus: ["EJ-AZ-S", "EJ-AZ-M"], image: "https://cdn.example.com/az.jpg" },
      { name: "Sunflower", skus: ["EJ-SF-S"], image: "https://cdn.example.com/main.jpg" },
    ]);
    assert.equal(fromFeed[0].price, 64);
    assert.equal(fromFeed[0].description, "Soft fleece .");
  });

  it("takes products as stores really have them", () => {
    const [mug, bare] = parseCatalog(
      "shopify_products",
      productsJsonToRows([
        // Frost Buddy: one color per product, in the title, under "Default Title".
        { id: 1, handle: "mug-twilight", title: "Mug Buddy 16oz | Twilight", body_html: null, product_type: "Thicc Buddy", tags: "Drinkware, Licensing", options: [{ name: "Title", position: 1 }], variants: [{ sku: "MB-TW", price: 34, option1: "Default Title", featured_image: null }], images: [{ src: "//cdn.shopify.com/mug.jpg" }] },
        { id: 2, title: "No Variants Tee" },
        { id: 3, handle: "untitled" },
      ]),
    );
    assert.deepEqual(mug, { handle: "mug-twilight", title: "Mug Buddy 16oz | Twilight", productType: "Thicc Buddy", category: "", tags: ["Drinkware", "Licensing"], description: "", price: 34, colorways: [] });
    assert.equal(bare.handle, "2");
    assert.equal(bare.title, "No Variants Tee");
  });
});

describe("fetchStorefrontCatalog", () => {
  it("reads every page and stops at the short one", async () => {
    const store = fakeStorefront({ host: HOST, products: products(507) });
    const catalog = await fetchStorefrontCatalog(STORE, { ...store, sleep: noWait });
    assert.deepEqual([catalog.items.length, catalog.pages, catalog.complete, catalog.note], [507, 3, true, undefined]);
    assert.equal(store.requests.length, 3);
    assert.match(store.requests[0], /\/products\.json\?limit=250&page=1$/);
  });

  it("reads from where the store lives after a redirect", async () => {
    const store = fakeStorefront({ host: `www.${HOST}`, redirectFrom: HOST, products: products(300) });
    const catalog = await fetchStorefrontCatalog(STORE, { ...store, sleep: noWait });
    assert.equal(catalog.origin, `https://www.${HOST}`);
    assert.equal(catalog.items.length, 300);
    assert.deepEqual(store.requests.map((u) => new URL(u).host), [HOST, `www.${HOST}`, `www.${HOST}`]);
  });

  it("stops at 20 pages, and reads each product once", async () => {
    const many = fakeStorefront({ host: HOST, products: products(600) });
    const capped = await fetchStorefrontCatalog(STORE, { ...many, sleep: noWait, maxPages: 2 });
    assert.deepEqual([capped.items.length, capped.complete], [500, false]);
    assert.match(capped.note ?? "", /more than 500 products/);
    assert.equal(STOREFRONT.maxPages * STOREFRONT.pageSize, 5000);

    const shifted = [...products(250), feedProduct(250), feedProduct(251)];
    const dupes = fakeStorefront({ host: HOST, products: shifted });
    assert.equal((await fetchStorefrontCatalog(STORE, { ...dupes, sleep: noWait })).items.length, 251);
  });

  it("waits and tries again when the store is busy", async () => {
    const store = fakeStorefront({ host: HOST, products: products(300), failOnce: { page: 2, status: 429 } });
    const waits: number[] = [];
    const catalog = await fetchStorefrontCatalog(STORE, { ...store, sleep: async (ms) => void waits.push(ms) });
    assert.deepEqual([catalog.items.length, catalog.complete], [300, true]);
    assert.deepEqual(waits, [1000], "Retry-After: 1");
  });

  it("says plainly when a store can't be read", async () => {
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: [], status: 404 }), sleep: noWait }), /doesn't have a Shopify product feed/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: [], body: "<html>Hi</html>" }), sleep: noWait }), /doesn't have a Shopify product feed/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: [], body: "{}" }), sleep: noWait }), /doesn't have a Shopify product feed/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: products(3), password: true }), sleep: noWait }), /is password protected/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: [], status: 403 }), sleep: noWait }), /turned Walkoff away \(HTTP 403\)/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: [], status: 503 }), sleep: noWait }), /is busy right now/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: products(3), addresses: { [HOST]: ["10.0.0.5"] } }), sleep: noWait }), /only read stores on the public internet/);
    await fails(fetchStorefrontCatalog("https://gone.example.com", { ...fakeStorefront({ host: HOST, products: [] }), sleep: noWait }), /couldn't find gone\.example\.com/);
    await fails(fetchStorefrontCatalog(STORE, { ...fakeStorefront({ host: HOST, products: [] }), sleep: noWait }), /product feed has no products/);
  });

  it("keeps what it read when a later page fails or time runs out", async () => {
    const store = fakeStorefront({ host: HOST, products: products(600) });
    const brokenPage2 = (async (input: string | URL | Request, init?: RequestInit) =>
      String(input).includes("page=2") ? new Response("", { status: 500 }) : store.fetch(input, init)) as typeof fetch;
    const partial = await fetchStorefrontCatalog(STORE, { fetch: brokenPage2, lookup: store.lookup, sleep: noWait });
    assert.deepEqual([partial.items.length, partial.complete], [250, false]);
    assert.match(partial.note ?? "", /busy right now\. Try again in a few minutes\. Walkoff read the first 250 products\./);

    let clock = 0;
    const slow = await fetchStorefrontCatalog(STORE, { ...store, sleep: noWait, now: () => (clock += 30_000) });
    assert.equal(slow.items.length, 250);
    assert.match(slow.note ?? "", /stopped after 1 pages to stay within time/);
  });
});
