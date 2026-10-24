import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCatalogItems, parseCatalogUpload, parseCustomerUpload, UploadError } from "./validate";

describe("parseCatalogUpload", () => {
  it("keeps colorways, with https photos only", () => {
    const { items } = parseCatalogUpload({
      format: "shopify_products",
      items: [
        {
          handle: "jogger",
          title: "Everyday Jogger",
          colorways: [
            { name: "Azure Heather", skus: ["EJ-AZ"], image: "https://cdn.example.com/az.jpg" },
            { name: "Sunflower", skus: ["EJ-SF"], image: "javascript:alert(1)" },
            { name: "", skus: ["EJ-X"] },
          ],
        },
      ],
    });
    assert.deepEqual(items[0].colorways, [
      { name: "Azure Heather", skus: ["EJ-AZ"], image: "https://cdn.example.com/az.jpg" },
      { name: "Sunflower", skus: ["EJ-SF"], image: "" },
    ]);
  });

  it("rejects products without titles", () => {
    assert.throws(() => parseCatalogUpload({ format: "catalog_csv", items: [{ handle: "x" }] }), UploadError);
  });
});

describe("what the upload API accepts", () => {
  it("only file formats: counts read through Claude and store imports come in another way", () => {
    const areas = [{ country: "US", area: "921", customers: 3 }];
    assert.throws(() => parseCustomerUpload({ format: "shopify_analytics", areas }), /Unknown file format/);
    assert.throws(() => parseCatalogUpload({ format: "shopify_store", items: [{ title: "Hoodie" }] }), /Unknown file format/);
    assert.equal(parseCustomerUpload({ format: "counts_csv", areas }).areas[0].customers, 3);
  });

  it("checks products the same way, whichever way they came", () => {
    assert.throws(() => parseCatalogItems([]), /No products found/);
    assert.throws(() => parseCatalogItems(Array.from({ length: 5001 }, (_, i) => ({ title: `P${i}` }))), /Too many products/);
    assert.deepEqual(parseCatalogItems([{ title: "  Bolt Hoodie ", tags: ["a", ""] }])[0], {
      handle: "bolt-hoodie",
      title: "Bolt Hoodie",
      productType: "",
      category: "",
      tags: ["a"],
      description: "",
      price: null,
      colorways: [],
    });
  });
});
