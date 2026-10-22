import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateCustomers, detectFormat, parseCatalog, productName, type Row } from "./imports";

// Header rows copied from real exports.
const SHOPIFY_CUSTOMERS = [
  "Customer ID", "First Name", "Last Name", "Email", "Accepts Email Marketing",
  "Default Address Company", "Default Address Address1", "Default Address Address2",
  "Default Address City", "Default Address Province Code", "Default Address Country Code",
  "Default Address Zip", "Default Address Phone", "Phone", "Accepts SMS Marketing",
  "Total Spent", "Total Orders", "Note", "Tax Exempt", "Tags",
];
const SHOPIFY_ORDERS = [
  "Name", "Email", "Financial Status", "Paid at", "Fulfillment Status", "Currency", "Subtotal",
  "Shipping", "Taxes", "Total", "Discount Code", "Created at", "Lineitem quantity", "Lineitem name",
  "Lineitem price", "Lineitem sku", "Billing Name", "Billing Zip", "Billing Country",
  "Shipping Name", "Shipping Street", "Shipping City", "Shipping Zip", "Shipping Province",
  "Shipping Country", "Vendor", "Id",
];
const KLAVIYO = [
  "Email", "Phone Number", "First Name", "Last Name", "Organization", "Address", "City",
  "State / Region", "Country", "Zip Code", "Source", "Email Marketing Consent",
];
const SHOPIFY_PRODUCTS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Variant SKU", "Variant Price", "Image Src", "Status",
];

function row(headers: string[], values: Record<string, string>): Row {
  return Object.fromEntries(headers.map((h) => [h, values[h] ?? ""]));
}

describe("detectFormat", () => {
  it("recognizes each export by its headers", () => {
    assert.equal(detectFormat(SHOPIFY_CUSTOMERS), "shopify_customers");
    assert.equal(detectFormat(SHOPIFY_ORDERS), "shopify_orders");
    assert.equal(detectFormat(KLAVIYO), "klaviyo_profiles");
    assert.equal(detectFormat(SHOPIFY_PRODUCTS), "shopify_products");
    assert.equal(detectFormat(["postal_code", "country", "customers", "revenue"]), "counts_csv");
    assert.equal(detectFormat(["title", "product type", "tags"]), "catalog_csv");
    assert.equal(detectFormat(["foo", "bar"]), null);
  });
});

describe("aggregateCustomers", () => {
  it("Shopify customers: one per row, cut to postal areas, no personal details", () => {
    const rows = [
      row(SHOPIFY_CUSTOMERS, { Email: "a@x.com", "First Name": "Ann", "Default Address Zip": "19147-1234", "Default Address Country Code": "US", "Total Spent": "120.50", "Total Orders": "3" }),
      row(SHOPIFY_CUSTOMERS, { Email: "b@x.com", "Default Address Zip": "19103", "Default Address Country Code": "US", "Total Spent": "$40.00", "Total Orders": "1" }),
      row(SHOPIFY_CUSTOMERS, { Email: "c@x.com", "Default Address Zip": "M5V 3L9", "Default Address Country Code": "CA", "Total Spent": "10", "Total Orders": "1" }),
      row(SHOPIFY_CUSTOMERS, { Email: "d@x.com", "Default Address Zip": "", "Total Spent": "5" }),
    ];
    const out = aggregateCustomers("shopify_customers", rows);
    assert.deepEqual(out.areas, [
      { country: "US", area: "191", customers: 2, orders: 4, revenue: 160.5 },
      { country: "CA", area: "M5V", customers: 1, orders: 1, revenue: 10 },
    ]);
    assert.equal(out.skipped, 1);
    const payload = JSON.stringify(out);
    for (const secret of ["a@x.com", "Ann", "19147", "3L9"]) assert.ok(!payload.includes(secret), `${secret} leaked`);
  });

  it("Shopify orders: buyers, orders and products per area", () => {
    const rows = [
      row(SHOPIFY_ORDERS, { Name: "#1001", Email: "a@x.com", Total: "90.00", "Lineitem quantity": "1", "Lineitem name": "Bird Gang Hoodie - L / Green", "Lineitem price": "60.00", "Shipping Zip": "19147", "Shipping Country": "US" }),
      row(SHOPIFY_ORDERS, { Name: "#1001", "Lineitem quantity": "2", "Lineitem name": "Koozie", "Lineitem price": "15.00" }),
      row(SHOPIFY_ORDERS, { Name: "#1002", Email: "a@x.com", Total: "60.00", "Lineitem quantity": "1", "Lineitem name": "Bird Gang Hoodie - M / Green", "Lineitem price": "60.00", "Shipping Zip": "19103", "Shipping Country": "US" }),
      row(SHOPIFY_ORDERS, { Name: "#1003", Email: "b@x.com", Total: "15.00", "Lineitem quantity": "1", "Lineitem name": "Koozie", "Lineitem price": "15.00", "Billing Zip": "N17 0AP", "Billing Country": "GB" }),
    ];
    const out = aggregateCustomers("shopify_orders", rows);
    assert.deepEqual(out.areas, [
      { country: "US", area: "191", customers: 1, orders: 2, revenue: 150 },
      { country: "GB", area: "N17", customers: 1, orders: 1, revenue: 15 },
    ]);
    assert.equal(out.rows, 3);
    const hoodies = out.products.find((p) => p.product === "Bird Gang Hoodie" && p.area === "191");
    assert.equal(hoodies?.orders, 2);
    assert.equal(hoodies?.revenue, 120);
    assert.ok(!JSON.stringify(out).includes("a@x.com"));
  });

  it("Klaviyo profiles", () => {
    const rows = [
      row(KLAVIYO, { Email: "a@x.com", "Zip Code": "60614", Country: "United States" }),
      row(KLAVIYO, { Email: "b@x.com", "Zip Code": "60657", Country: "United States" }),
      row(KLAVIYO, { Email: "c@x.com", "Zip Code": "75001", Country: "France" }),
    ];
    const out = aggregateCustomers("klaviyo_profiles", rows);
    assert.deepEqual(out.areas, [{ country: "US", area: "606", customers: 2, orders: 0, revenue: 0 }]);
    assert.equal(out.skipped, 1);
  });

  it("a spreadsheet that's already counts", () => {
    const out = aggregateCustomers("counts_csv", [
      { postal_code: "19147", customers: "212", revenue: "9840" },
      { postal_code: "53202", customers: "96", revenue: "2210" },
      { postal_code: "19103", customers: "10", revenue: "100" },
    ]);
    assert.deepEqual(out.areas, [
      { country: "US", area: "191", customers: 222, orders: 0, revenue: 9940 },
      { country: "US", area: "532", customers: 96, orders: 0, revenue: 2210 },
    ]);
  });
});

describe("parseCatalog", () => {
  it("folds Shopify variant rows into products", () => {
    const rows = [
      row(SHOPIFY_PRODUCTS, { Handle: "bird-gang-hoodie", Title: "Bird Gang Hoodie", "Body (HTML)": "<p>Midweight fleece in <b>midnight green</b>.</p>", Type: "Hoodie", Tags: "eagles, football, fall", "Variant Price": "64.00" }),
      row(SHOPIFY_PRODUCTS, { Handle: "bird-gang-hoodie", "Option1 Value": "XL", "Variant Price": "68.00" }),
      row(SHOPIFY_PRODUCTS, { Handle: "koozie", Title: "Can Koozie", Type: "Drinkware", "Variant Price": "15" }),
    ];
    assert.deepEqual(parseCatalog("shopify_products", rows), [
      {
        handle: "bird-gang-hoodie",
        title: "Bird Gang Hoodie",
        productType: "Hoodie",
        category: "",
        tags: ["eagles", "football", "fall"],
        description: "Midweight fleece in midnight green .",
        price: 64,
        colorways: [],
      },
      { handle: "koozie", title: "Can Koozie", productType: "Drinkware", category: "", tags: [], description: "", price: 15, colorways: [] },
    ]);
  });

  it("collects colorways from the color option, with SKUs and photos", () => {
    const headers = [...SHOPIFY_PRODUCTS, "Option2 Name", "Option2 Value", "Variant Image"];
    const rows = [
      row(headers, { Handle: "jogger", Title: "Everyday Jogger", Type: "Pants", "Option1 Name": "Size", "Option1 Value": "S", "Option2 Name": "Color", "Option2 Value": "Azure Heather", "Variant SKU": "EJ-AZ-S", "Variant Image": "https://cdn.example.com/az.jpg", "Image Src": "https://cdn.example.com/main.jpg" }),
      row(headers, { Handle: "jogger", "Option1 Value": "M", "Option2 Value": "Azure Heather", "Variant SKU": "EJ-AZ-M" }),
      row(headers, { Handle: "jogger", "Option1 Value": "S", "Option2 Value": "Sunflower", "Variant SKU": "EJ-SF-S" }),
      row(headers, { Handle: "cap", Title: "Plain Cap", "Option1 Name": "Title", "Option1 Value": "Default Title", "Variant SKU": "CAP-1" }),
    ];
    const [jogger, cap] = parseCatalog("shopify_products", rows);
    assert.deepEqual(jogger.colorways, [
      { name: "Azure Heather", skus: ["EJ-AZ-S", "EJ-AZ-M"], image: "https://cdn.example.com/az.jpg" },
      { name: "Sunflower", skus: ["EJ-SF-S"], image: "https://cdn.example.com/main.jpg" },
    ]);
    assert.deepEqual(cap.colorways, [], "Default Title isn't a color");
  });

  it("falls back to Shopify's color field, and reads a color column in plain sheets", () => {
    const headers = [...SHOPIFY_PRODUCTS, "Color (product.metafields.shopify.color-pattern)"];
    const [short] = parseCatalog("shopify_products", [
      row(headers, { Handle: "short", Title: "Trail Short", "Variant SKU": "TS-1", "Color (product.metafields.shopify.color-pattern)": "Blue; Yellow" }),
    ]);
    assert.deepEqual(short.colorways.map((c) => [c.name, c.skus]), [["Blue", ["TS-1"]], ["Yellow", ["TS-1"]]]);

    const sheet = ["title", "type", "color", "sku"];
    const [tee] = parseCatalog("catalog_csv", [
      row(sheet, { title: "Performance Tee", type: "Tee", color: "Royal", sku: "PT-R" }),
      row(sheet, { title: "Performance Tee", type: "Tee", color: "Marigold", sku: "PT-M" }),
    ]);
    assert.deepEqual(tee.colorways.map((c) => c.name), ["Royal", "Marigold"]);
  });

  it("product names drop the variant", () => {
    assert.equal(productName("Bird Gang Hoodie - L / Green"), "Bird Gang Hoodie");
  });
});
