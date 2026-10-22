import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { colorFamily, colorMatch, hexForColorName, isNeutral, teamPalette } from "./colors";

const CHARGERS_BLUE = "0080c6";
const RAMS_BLUE = "003594";
const EAGLES_GREEN = "06424d";

describe("hexForColorName", () => {
  it("reads common color words, phrases and modifiers", () => {
    assert.deepEqual(hexForColorName("Azure Heather"), hexForColorName("Azure"), "heather only describes the azure");
    assert.equal(hexForColorName("Heather Grey").length, 1);
    assert.equal(hexForColorName("Navy/Gold").length, 2);
    assert.deepEqual(hexForColorName("Kelly Green"), ["00843d"]);
    assert.notDeepEqual(hexForColorName("Light Sage"), hexForColorName("Sage"));
    assert.deepEqual(hexForColorName("Cove"), [], "fanciful names are Claude's job");
  });
});

describe("colorMatch", () => {
  it("tells LA's two blues apart", () => {
    const [azure] = hexForColorName("Azure");
    const [royal] = hexForColorName("Royal");
    assert.ok(colorMatch(CHARGERS_BLUE, azure) > 0.7);
    assert.ok(colorMatch(CHARGERS_BLUE, royal) < 0.3);
    assert.ok(colorMatch(RAMS_BLUE, royal) > 0.6);
    assert.ok(colorMatch(RAMS_BLUE, azure) < 0.3);
  });

  it("never lets a neutral stand in for a team color", () => {
    const [black] = hexForColorName("Black");
    assert.ok(colorMatch(EAGLES_GREEN, black) < 0.2);
    assert.ok(colorMatch(EAGLES_GREEN, hexForColorName("Dark Teal")[0]) > 0.5);
  });
});

describe("families and palettes", () => {
  it("names a hex the way a shopper would", () => {
    assert.equal(colorFamily("ffc20e"), "gold");
    assert.equal(colorFamily("552583"), "purple");
    assert.equal(colorFamily(EAGLES_GREEN), "midnight green");
    assert.equal(colorFamily("3b6e8f"), "blue", "a muted blue like Cove");
    assert.equal(colorFamily("36454f"), "charcoal");
  });

  it("weighs a team's main color most and neutrals least", () => {
    assert.ok(isNeutral("000000") && isNeutral("a5acaf") && !isNeutral(CHARGERS_BLUE));
    const [main, second] = teamPalette(["000000", "fdb71a"]);
    assert.ok(main.weight < second.weight, "black says less than Pittsburgh gold");
  });
});
