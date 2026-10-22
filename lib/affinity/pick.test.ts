import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hexForColorName } from "./colors";
import { pickForTeam, type PickProduct } from "./pick";

const CHARGERS = { id: "24", colors: ["0080c6", "ffc20e"] };
const RAMS = { id: "14", colors: ["003594", "ffd100"] };
const RAIDERS = { id: "13", colors: ["000000", "a5acaf"] };

const cw = (name: string) => ({ name, hex: hexForColorName(name), skus: [`SKU-${name}`], image: "" });

const catalog: PickProduct[] = [
  { handle: "jogger", title: "Everyday Jogger", teams: [], colorways: ["Azure Heather", "Black", "Heather Grey"].map(cw), uses: [] },
  { handle: "hoodie", title: "Sunday Hoodie", teams: [], colorways: ["Sunflower", "Dune", "Black"].map(cw), uses: [] },
  { handle: "tee", title: "Performance Tee", teams: [], colorways: ["Royal", "Salt", "Charcoal"].map(cw), uses: ["game_day"] },
  { handle: "short", title: "Trail Short", teams: [], colorways: ["Sage", "Black"].map(cw), uses: [] },
];

const titles = (picks: ReturnType<typeof pickForTeam>) => picks.map((p) => `${p.title} · ${p.colorway}`);

describe("pickForTeam", () => {
  it("picks the colorways in a team's colors, one per color first", () => {
    const picks = pickForTeam(catalog, "nfl", CHARGERS);
    assert.deepEqual(titles(picks).slice(0, 2), ["Everyday Jogger · Azure Heather", "Sunday Hoodie · Sunflower"]);
    assert.equal(picks[0].why, "Close to their blue");
    assert.deepEqual(picks[0].skus, ["SKU-Azure Heather"]);
  });

  it("the Rams get royal, not the Chargers' azure", () => {
    const picks = titles(pickForTeam(catalog, "nfl", RAMS));
    assert.ok(picks.includes("Performance Tee · Royal"));
    assert.ok(!picks.includes("Everyday Jogger · Azure Heather"));
  });

  it("each team color gets its own product when it can", () => {
    // Blue is in both products, gold only in the hoodie: the jogger takes blue.
    const products: PickProduct[] = [
      { title: "Sunday Hoodie", teams: [], colorways: [cw("Cobalt"), cw("Sunflower")] },
      { title: "Everyday Jogger", teams: [], colorways: [cw("Royal")] },
    ];
    const picks = titles(pickForTeam(products, "nfl", RAMS));
    assert.deepEqual(picks.slice(0, 2), ["Everyday Jogger · Royal", "Sunday Hoodie · Sunflower"], "main color still leads");
  });

  it("black and silver alone aren't a nod", () => {
    assert.deepEqual(pickForTeam(catalog, "nfl", RAIDERS), []);
  });

  it("products made for the team come first, then colors", () => {
    const licensed: PickProduct = { title: "Bolt Tumbler", teams: [{ league: "nfl", teamId: "24" }], colorways: [cw("Black")] };
    const picks = pickForTeam([...catalog, licensed], "nfl", CHARGERS);
    assert.equal(picks[0].title, "Bolt Tumbler");
    assert.equal(picks[0].why, "Made for their fans");
    assert.equal(picks[0].colorway, null, "black isn't a Chargers color, so no colorway is named");
  });

  it("uses colors from the title when there are no colorways", () => {
    const picks = pickForTeam([{ title: "Gold Rush Tumbler", teams: [], colors: ["gold"] }], "nfl", CHARGERS);
    assert.equal(picks[0]?.colorway, null);
    assert.equal(picks[0]?.why, "Close to their gold");
    assert.deepEqual(picks[0]?.hex.length, 1, "the title's color still gets a swatch");
  });
});
