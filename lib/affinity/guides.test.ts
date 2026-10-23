import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GUIDES } from "./guides";
import { FORMAT_LABEL, formatKind, type ImportFormat } from "./imports";

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
});
