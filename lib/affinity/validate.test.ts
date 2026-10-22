import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCatalogUpload, UploadError } from "./validate";

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
