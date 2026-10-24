import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POSTAL_AREAS } from "./geo";
import { regionCode } from "./regions";

describe("regionCode", () => {
  it("reads names and codes the way stores write them", () => {
    for (const raw of ["Texas", "TX", "tx", "US-TX", " texas "]) assert.equal(regionCode("US", raw), "TX", raw);
    assert.equal(regionCode("US", "California"), "CA");
    assert.equal(regionCode("US", "CA"), "CA", "CA is California inside the US");
    for (const raw of ["District of Columbia", "Washington DC", "Washington, D.C.", "DC"]) assert.equal(regionCode("US", raw), "DC", raw);
    assert.equal(regionCode("US", "Washington"), "WA");
    assert.equal(regionCode("US", "Puerto Rico"), "PR");
    for (const raw of ["Québec", "Quebec", "QC", "CA-QC"]) assert.equal(regionCode("CA", raw), "QC", raw);
    assert.equal(regionCode("CA", "Newfoundland"), "NL");
    assert.equal(regionCode("CA", "Île-du-Prince-Édouard"), "PE");
  });

  it("has no answer for the UK, blanks or places it doesn't map", () => {
    for (const raw of ["England", "ENG", "", "Greater London"]) assert.equal(regionCode("GB", raw), null, raw);
    assert.equal(regionCode("US", ""), null);
    assert.equal(regionCode("US", null), null);
    assert.equal(regionCode("US", "Armed Forces Europe"), null);
    assert.equal(regionCode("US", "Ontario"), null);
    assert.equal(regionCode("CA", "Texas"), null);
  });

  it("knows every state and province the postal areas use", () => {
    for (const country of ["US", "CA"] as const) {
      const regions = new Set(POSTAL_AREAS.filter((a) => a.country === country).map((a) => a.region));
      for (const r of regions) assert.equal(regionCode(country, r), r, `${country}:${r}`);
    }
  });
});
