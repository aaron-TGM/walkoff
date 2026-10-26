import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tagProduct } from "./tagging";

function tag(title: string, extra: { tags?: string[]; type?: string; description?: string } = {}) {
  return tagProduct({
    title,
    productType: extra.type ?? "",
    category: "",
    tags: extra.tags ?? [],
    description: extra.description ?? "",
  });
}

const teams = (t: ReturnType<typeof tag>) => t.teams.map((x) => `${x.league}:${x.name}`).sort();

describe("tagProduct", () => {
  it("finds pro teams by name and unique nickname", () => {
    assert.deepEqual(teams(tag("Philadelphia Eagles Win Day Tee")), ["nfl:Philadelphia Eagles"]);
    assert.deepEqual(teams(tag("Bird Gang Hoodie", { tags: ["eagles", "fall"] })), ["nfl:Philadelphia Eagles"]);
  });

  it("needs a sport word for nicknames two leagues share", () => {
    assert.deepEqual(teams(tag("Giants Fan Cap")), []);
    assert.deepEqual(teams(tag("Giants Baseball Cap")), ["mlb:San Francisco Giants"]);
    assert.deepEqual(teams(tag("Giants Football Cap")), ["nfl:New York Giants"]);
  });

  it("college: longest school name wins", () => {
    assert.deepEqual(teams(tag("Michigan State Spartans Tumbler")).length, 2, "football and basketball");
    assert.ok(teams(tag("Michigan State Spartans Tumbler")).every((t) => t.includes("Michigan State")));
    assert.deepEqual(teams(tag("Ohio State Football Koozie")), ["ncaaf:Ohio State Buckeyes"]);
  });

  it("a sport word shared by pro and college still means the pro team", () => {
    assert.deepEqual(teams(tag("Eagles Football Tee")), ["nfl:Philadelphia Eagles"]);
    assert.deepEqual(teams(tag("Bird Gang Hoodie", { tags: ["eagles", "football"] })), ["nfl:Philadelphia Eagles"]);
    assert.deepEqual(teams(tag("Eagles College Football Tee")), ["ncaaf:Boston College Eagles"]);
    assert.deepEqual(teams(tag("Wildcats College Tee")), [], "too many Wildcats");
  });

  it("doesn't read a pro city as a college", () => {
    assert.deepEqual(teams(tag("Miami Sunset Tee")), []);
  });

  it("Premier League clubs and their nicknames", () => {
    assert.deepEqual(teams(tag("Spurs Home Kit Scarf")), ["epl:Tottenham Hotspur"]);
    assert.deepEqual(teams(tag("Man Utd Mug")), ["epl:Manchester United"]);
  });

  it("colors, uses and seasons", () => {
    const t = tag("Bird Gang Hoodie", { type: "Hoodie", description: "Midweight fleece in midnight green." });
    assert.deepEqual(t.colors, ["midnight green"]);
    assert.ok(t.uses.includes("cold_weather"));
    assert.deepEqual(t.seasons.sort(), ["fall", "winter"]);
    assert.ok(tag("Can Koozie 4-Pack", { type: "Drinkware" }).uses.includes("tailgate"));
    assert.ok(tag("Holiday Gift Bundle").uses.includes("gift"));
  });
});

describe("tagProduct everyday words", () => {
  it("doesn't read an everyday word as a team", () => {
    const products: [string, string][] = [
      // From a real store's feed.
      ["Joggy Doggy Tee", "Tee features scrapbook scribbles all over and diamante stars."],
      ["Stars and Stripes Tee", ""],
      ["Teddy Bears Onesie", ""],
      ["Wireless Chargers 2-Pack", ""],
      ["Heat Transfer Vinyl Tee", ""],
      ["Lightning Bolt Tee", ""],
      ["Cowboys and Cowgirls Hat", ""],
      ["Angels Ornament", ""],
    ];
    for (const [title, description] of products) assert.deepEqual(teams(tag(title, { description })), [], title);
  });

  it("still finds the team with its sport, its place or its fans", () => {
    assert.deepEqual(teams(tag("Stars Hockey Hoodie")), ["nhl:Dallas Stars"]);
    assert.deepEqual(teams(tag("Stars Tee", { description: "Printed in Dallas." })), ["nhl:Dallas Stars"]);
    assert.deepEqual(teams(tag("Go Stars Tee")), ["nhl:Dallas Stars"]);
    assert.deepEqual(teams(tag("Dallas Stars Tee")), ["nhl:Dallas Stars"]);
    assert.deepEqual(teams(tag("Bears Fans Tumbler")), ["nfl:Chicago Bears"]);
    assert.deepEqual(teams(tag("Heat Game Day Tee")), ["nba:Miami Heat"]);
    assert.deepEqual(teams(tag("LA Kings Hockey Hoodie")), ["nhl:Los Angeles Kings"]);
  });

  it("keeps a color that's also a nickname", () => {
    const orange = tag("Orange Crew Sweatshirt");
    assert.deepEqual([teams(orange), orange.colors], [[], ["orange"]]);
    assert.deepEqual(tag("Syracuse Orange Hoodie").colors, [], "the full name is the team");
    assert.deepEqual(tag("Cardinal Red Beanie").colors, ["red"]);
  });
});

describe("tagProduct colors", () => {
  it("ignores colors inside team names", () => {
    assert.deepEqual(tag("Duke Blue Devils Tee").colors, []);
    assert.deepEqual(tag("Free Lid Koozie - Cubs Blue", { tags: ["baseball"] }).colors, ["blue"]);
  });
});

describe("tagProduct interests", () => {
  it("finds the scene a product is made for", () => {
    assert.deepEqual(tag("Pipeline Boardshorts", { type: "Boardshorts" }).interests, ["surf"]);
    assert.deepEqual(tag("Offshore Fishing Hat", { tags: ["fishing"] }).interests, ["fishing"]);
    assert.deepEqual(tag("Rodeo Pearl Snap Shirt").interests, ["western"]);
    assert.deepEqual(tag("Philadelphia Eagles Win Day Tee").interests, []);
  });

  it("matches whole words only", () => {
    assert.deepEqual(tag("Skates Bay Tee").interests, []);
    assert.deepEqual(tag("Golfball White Socks").interests, []);
  });
});
