import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POSTAL_AREAS } from "../affinity/geo";
import { teamAudience, territoryCircles } from "./audience";
import { teamByKey } from "./teams";

const CHARGERS = teamByKey("nfl:24")!;
const SPURS = teamByKey("epl:367")!;

describe("territoryCircles", () => {
  it("covers the Chargers' San Diego core with one circle on a real ZIP", () => {
    const { circles, coverage, precision } = territoryCircles(CHARGERS);
    assert.equal(circles.length, 1);
    assert.match(circles[0].postal_code, /^92\d{3}$/);
    assert.ok(coverage >= 0.8, `coverage ${coverage}`);
    assert.ok(precision >= 0.8, `precision ${precision}`);
  });

  it("reaching wide adds the shared Los Angeles market", () => {
    const core = territoryCircles(CHARGERS);
    const wide = territoryCircles(CHARGERS, "wide");
    assert.ok(wide.inside.size > core.inside.size);
    assert.ok(wide.inside.has("US:900"), "Los Angeles");
  });

  it("club circles are small and centered on a postcode district, the part Klaviyo reads", () => {
    // Klaviyo's proximity condition takes UK outward codes: for "SW1W 0NY"
    // only "SW1W" works (help.klaviyo.com/hc/en-us/articles/115005065887).
    const { circles } = territoryCircles(SPURS);
    assert.ok(circles.length >= 1);
    assert.ok(circles.every((c) => c.radius_miles <= 15));
    for (const c of circles) {
      assert.match(c.postal_code, /^[A-Z]{1,2}\d[A-Z\d]?$/);
      assert.equal(c.center_area, `around ${c.postal_code}`);
    }
  });
});

describe("teamAudience", () => {
  it("names the segment and spells out the Klaviyo conditions", () => {
    const a = teamAudience(CHARGERS);
    assert.equal(a.segment_name, "Walkoff · Los Angeles Chargers fans");
    assert.match(a.klaviyo_segment_steps.join("\n"), /proximity to a location": is within 25 miles of 92\d{3} \(United States\)/);
    assert.equal(a.outward_codes, undefined);
  });

  it("clubs get their outward codes, and steps that use them", () => {
    const a = teamAudience(SPURS);
    assert.match(a.klaviyo_segment_steps.join("\n"), /is within \d+ miles of [A-Z]{1,2}\d[A-Z\d]? \(United Kingdom\)/);
    assert.match(a.klaviyo_segment_steps.join("\n"), /check the segment isn't empty/);
    assert.ok(a.outward_codes!.includes("N17"));
    assert.ok(a.outward_codes!.every((c) => POSTAL_AREAS.some((p) => p.country === "GB" && p.code === c)));
  });

  it("counts the brand's customers inside the audience", () => {
    const a = teamAudience(CHARGERS, { customersByArea: new Map([["US:921", 840], ["US:100", 300]]) });
    assert.deepEqual(a.customers, { in_circles: 840, in_core_areas: 840, uploaded: 1140 });
  });
});
