import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GUIDES } from "./guides";
import { aggregateCustomers, detectFormat, FORMAT_LABEL, formatKind, type ImportFormat } from "./imports";

describe("export guides", () => {
  it("send each file to the upload step that reads its format", () => {
    for (const g of GUIDES) {
      const step = formatKind(g.format) === "catalog" ? "step 2" : "step 1";
      const said = g.steps.join(" ").match(/step \d/g) ?? [];
      assert.ok(said.length, `${g.title} never says which step`);
      for (const s of said) assert.equal(s, step, g.title);
    }
  });

  it("cover every format the upload page reads", () => {
    const covered = new Set(GUIDES.map((g) => g.format));
    for (const f of Object.keys(FORMAT_LABEL) as ImportFormat[]) {
      // A product spreadsheet is the note on the last guide.
      if (f === "catalog_csv") assert.match(GUIDES[GUIDES.length - 1].note ?? "", /products.*step 2/);
      else assert.ok(covered.has(f), `no guide for ${f}`);
    }
  });

  it("start with the Klaviyo export, and name the columns the upload page reads", () => {
    const klaviyo = GUIDES[0];
    assert.equal(klaviyo.format, "klaviyo_profiles");
    const steps = klaviyo.steps.join(" ");
    const columns = ["Email", "Zip Code", "Country"];
    for (const c of columns) assert.ok(steps.includes(c), `the guide doesn't ask for ${c}`);
    // An export with just those columns is read as Klaviyo profiles, and
    // placed by zip code.
    assert.equal(detectFormat(columns), "klaviyo_profiles");
    const out = aggregateCustomers("klaviyo_profiles", [
      { Email: "a@x.com", "Zip Code": "92101", Country: "United States" },
      { Email: "b@x.com", "Zip Code": "M5V 2T6", Country: "Canada" },
      { Email: "c@x.com", "Zip Code": "", Country: "United States" },
    ]);
    assert.deepEqual(out.areas.map((a) => [a.country, a.area, a.customers]), [["US", "921", 1], ["CA", "M5V", 1]]);
    assert.equal(out.skipped, 1);
    assert.equal(GUIDES.find((g) => g.format === "shopify_orders")?.best?.includes("what each territory buys"), true, "orders stay the richer option");
  });
});
