import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AreaCount } from "../affinity/compute";
import { POSTAL_AREAS } from "../affinity/geo";
import {
  CIRCLE,
  loadZips,
  nameKey,
  nearestPlace,
  placeByKey,
  placeLabel,
  resolvePlace,
  resolveTown,
  townCircle,
  townCustomers,
  townLift,
  type Place,
  type Resolved,
} from ".";

const found = (r: Resolved) => (r.status === "found" ? r.place.key : r.status);

async function town(text: string): Promise<Place> {
  const r = await resolveTown(text);
  assert.equal(r.status, "found", `${text}: ${r.status}`);
  return (r as { place: Place }).place;
}

describe("place names", () => {
  it("meet whatever the spelling", () => {
    assert.equal(nameKey("St. Louis"), nameKey("Saint Louis"));
    assert.equal(nameKey("Ste. Genevieve"), "saintegenevieve");
    assert.equal(nameKey("Ft. Lauderdale"), nameKey("Fort Lauderdale"));
    assert.equal(nameKey("Mc Lean"), nameKey("McLean"));
    assert.equal(nameKey("Coeur d'Alene"), "coeurdalene");
    assert.equal(nameKey("Bayamón"), "bayamon");
    assert.equal(nameKey("Winston-Salem"), nameKey("Winston Salem"));
    assert.equal(nameKey("St-Jean-sur-Richelieu"), nameKey("Saint-Jean-sur-Richelieu"));
  });
});

describe("finding a place", () => {
  it("reads ESPN's birthplace for Sam Darnold", async () => {
    const r = await resolvePlace({ city: "Capistrano Beach", state: "CA", country: "USA" });
    assert.equal(found(r), "zip:92624");
    const place = (r as { place: Place }).place;
    assert.equal(place.ref, "92624");
    assert.equal(placeLabel(place), "Capistrano Beach, CA");
  });

  it("reads a town and state given together as the city", async () => {
    assert.equal(found(await resolvePlace({ city: "Chicago, IL", country: "USA" })), "census:1714000");
    assert.equal(found(await resolvePlace({ city: "Rancho Santa Fe, CA" })), "census:0659584");
  });

  it("reads a golf bio's padded full state name", async () => {
    assert.equal((await town("La Jolla, California               ")).key, "zip:92037");
  });

  it("treats St. and Saint alike", async () => {
    assert.equal((await town("St. Louis, MO")).key, "census:2965000");
    assert.equal((await town("Saint Louis, Missouri")).key, "census:2965000");
  });

  it("covers Puerto Rico, and means the city over a community with its name", async () => {
    assert.equal(found(await resolvePlace({ city: "Bayamon", country: "Puerto Rico" })), "census:7206593");
    assert.equal((await town("Bayamón, PR")).key, "census:7206593");
  });

  it("finds Canadian towns by province code or name", async () => {
    assert.equal((await town("Saskatoon, SK")).key, "geonames:6141256");
    const r = await resolvePlace({ city: "Saskatoon", state: "Saskatchewan", country: "Canada" });
    assert.equal(found(r), "geonames:6141256");
    assert.match((r as { place: Place }).place.ref, /^S7. \d[A-Z]\d$/);
  });

  it("finds UK towns by nation, and passes over a county it can't read", async () => {
    const holywood = await town("Holywood, Northern Ireland");
    assert.equal(holywood.key, "geonames:2646670");
    assert.equal(holywood.ref.split(" ")[0], "BT18");
    assert.equal(placeLabel(holywood), "Holywood, Northern Ireland");
    assert.equal(found(await resolvePlace({ city: "Holywood", state: "County Down", country: "Northern Ireland" })), holywood.key);
    assert.equal((await town("Newcastle, England")).key, "geonames:2641673");
    assert.equal((await town("Londonderry, Northern Ireland")).key, "geonames:2643736");
  });

  it("says outside for a country Walkoff doesn't cover, and unknown for text it can't read", async () => {
    assert.deepEqual(await resolveTown("Uppsala, Sweden"), { status: "outside", country: "Sweden" });
    assert.deepEqual(await resolveTown("Santo Domingo, Distrito Nacional, Dominican Republic"), { status: "outside", country: "Dominican Republic" });
    assert.deepEqual(await resolvePlace({ city: "Toronto", country: "Australia" }), { status: "outside", country: "Australia" });
    assert.deepEqual(await resolvePlace({ city: "Willemstad", country: "Curacao" }), { status: "outside", country: "Curacao" });
    // Hockey rosters' three-letter codes.
    assert.deepEqual(await resolvePlace({ city: "Karlstad", country: "SWE" }), { status: "outside", country: "SWE" });
    assert.equal(found(await resolvePlace({ city: "Saskatoon", state: "SK", country: "CAN" })), "geonames:6141256");
    assert.equal((await resolveTown("Holywood, County Down")).status, "unknown");
  });

  it("never guesses between places that share a name", async () => {
    const springfield = await resolveTown("Springfield");
    assert.equal(springfield.status, "ambiguous");
    assert.equal((await town("Springfield, IL")).key, "census:1772000");
    const pa = await resolveTown("Springfield, PA");
    assert.equal(pa.status, "ambiguous");
    assert.equal((pa as { candidates: Place[] }).candidates.length, 9);
    assert.ok((pa as { candidates: Place[] }).candidates.every((p) => p.key.startsWith("cousub:") && p.region === "PA"));
    assert.equal((await resolveTown("Toronto")).status, "ambiguous", "Ontario's, and Ohio's");
    assert.equal((await resolveTown("Derry")).status, "ambiguous", "Northern Ireland's, and New Hampshire's");
    // A region it can't read, and no country: searching everywhere would
    // find Sydney, Nova Scotia.
    assert.equal(found(await resolvePlace({ city: "Sydney", state: "NSW" })), "unknown");
  });

  it("means the city over a community with its name, and city-counties by the city", async () => {
    assert.equal((await town("Burbank, CA")).key, "census:0608954");
    assert.equal((await town("Louisville, KY")).key, "census:2148006");
    assert.equal((await town("Nashville, TN")).key, "census:4752006");
    assert.equal((await town("Ventura, CA")).key, "census:0665042");
    assert.equal((await town("San Buenaventura, CA")).key, "census:0665042");
    assert.equal((await town("Honolulu, HI")).key, "census:1571550");
    assert.equal((await town("New York City, NY")).key, "census:3651000");
    // A UK name goes to a place five times the size of the next.
    assert.equal(found(await resolvePlace({ city: "Newcastle", country: "UK" })), "geonames:2641673");
  });

  it("takes neighbors that share a name as one town, and a legal name gives way", async () => {
    // A city and a village next to each other.
    assert.equal((await town("Waukesha, WI")).key, "census:5584250");
    assert.equal((await resolveTown("Pewaukee, WI")).status, "found");
    // "Centerville (Thurman) village" is Thurman; Centerville is the city.
    assert.equal((await town("Centerville, OH")).key, "census:3913190");
    assert.equal((await town("Thurman, OH")).key, "census:3913169");
    // Far apart, they stay apart: Oahu's Kailua and the Big Island's.
    assert.equal((await resolveTown("Kailua, HI")).status, "ambiguous");
    assert.deepEqual(await resolveTown("Kinshasa, Congo"), { status: "outside", country: "Congo" });
  });

  it("knows towns, townships and the postal names Census doesn't use", async () => {
    assert.equal((await town("Cherry Hill, NJ")).key, "cousub:3400712280");
    assert.equal((await town("Brooklyn, NY")).key, "cousub:3604710022");
    assert.equal((await town("Sherman Oaks, CA")).key, "zip:91403");
    assert.equal((await town("Capistrano Beach, Calif.")).key, "zip:92624");
  });

  it("takes a postal code as the town there", async () => {
    // 92672's census center is out on Camp Pendleton; its postal name is San Clemente.
    assert.equal((await town("92672")).key, "census:0665084");
    assert.equal((await town("92624")).key, "zip:92624");
    assert.equal((await town("S7K 1N5")).key, "geonames:6141256");
    assert.equal((await town("BT18 9DE")).key, "geonames:2646670");
    assert.equal((await town("bt18")).key, "geonames:2646670");
    assert.equal((await resolveTown("T0A 0A0")).status, "unknown", "a rural area spans many towns");
    assert.equal((await resolveTown("00000")).status, "unknown");
  });

  it("finds the town at a point, and a place by its key", async () => {
    // San Clemente High School.
    assert.equal((await nearestPlace("US", 33.4447, -117.6188))?.key, "census:0665084");
    assert.equal((await nearestPlace("GB", 54.6386, -5.8247))?.key, "geonames:2646670");
    assert.equal((await placeByKey("census:0665084"))?.name, "San Clemente");
    assert.equal((await placeByKey("geonames:2646670"))?.name, "Holywood");
    assert.equal(await placeByKey("census:nope"), null);
  });
});

describe("town circles", () => {
  it("draws San Clemente's on its own ZIP, 3 to 8 miles, with 75,000 people or more", async () => {
    const place = await town("San Clemente, CA");
    const c = await townCircle(place);
    assert.match(c.ref, /^9267\d$/);
    assert.ok(c.radiusMiles >= 3 && c.radiusMiles <= 8, `${c.radiusMiles} miles`);
    assert.ok(c.radiusMiles >= CIRCLE.cover * place.radius);
    assert.ok(c.population >= CIRCLE.minPeople && !c.bigCity, `${c.population} people`);
    assert.ok(c.shares["US:926"] > 0 && c.shares["US:926"] < 0.2, "a slice of Orange County's 926");
  });

  it("calls a big city one", async () => {
    for (const name of ["Chicago, IL", "Brooklyn, NY", "Toronto, ON", "San Francisco, CA"]) {
      const c = await townCircle(await town(name));
      assert.ok(c.bigCity && c.population > CIRCLE.bigCity, name);
    }
  });

  it("centers a city whose waters Census counts on its people", async () => {
    // Census's point for San Francisco is out by the Farallon Islands, and
    // the ZIP nearest it is Bolinas, across the Golden Gate.
    const sf = await town("San Francisco, CA");
    assert.match(sf.ref, /^941\d\d$/);
    assert.equal((await town("Corpus Christi, TX")).ref, "78401");
  });

  it("gives a rural town the widest circle", async () => {
    const c = await townCircle(await town("Marfa, TX"));
    assert.equal(c.radiusMiles, 25);
    assert.ok(c.population < CIRCLE.minPeople);
  });

  it("uses a radius asked for, kept between 1 and 50 miles", async () => {
    const place = await town("San Clemente, CA");
    assert.equal((await townCircle(place, { radiusMiles: 10 })).radiusMiles, 10);
    assert.equal((await townCircle(place, { radiusMiles: 500 })).radiusMiles, CIRCLE.maxMiles);
    assert.equal((await townCircle(place, { radiusMiles: 0.2 })).radiusMiles, CIRCLE.minMiles);
  });

  it("counts whole areas in Canada and the UK, a quarter of a rural one", async () => {
    const holywood = await townCircle(await town("Holywood, Northern Ireland"));
    assert.equal(holywood.shares["GB:BT18"], 1);
    assert.equal(holywood.ref.split(" ")[0], "BT18");
    const saskatoon = await townCircle(await town("Saskatoon, SK"));
    assert.equal(saskatoon.shares["CA:S7K"], 1);
    const humboldt = await town("Humboldt, SK");
    const rural = await townCircle(humboldt);
    assert.equal(rural.shares[`CA:${humboldt.ref.slice(0, 3)}`], 0.25, "its own rural area, counted once");
  });

  it("splits US areas by the people in their ZIPs, which add up to each area", async () => {
    const sums = new Map<string, number>();
    for (const z of (await loadZips()).values()) sums.set(z.zip.slice(0, 3), (sums.get(z.zip.slice(0, 3)) ?? 0) + z.population);
    for (const a of POSTAL_AREAS.filter((x) => x.country === "US")) {
      assert.ok(Math.abs((sums.get(a.code) ?? 0) - a.population) <= 10, `${a.code}: ${sums.get(a.code)} vs ${a.population}`);
    }
  });
});

describe("customers in a circle", () => {
  it("estimates them from each area's share, and the lift against the country", async () => {
    const c = await townCircle(await town("San Clemente, CA"));
    const counts: AreaCount[] = [
      { country: "US", area: "926", customers: 1000 },
      { country: "US", area: "100", customers: 500 },
      { country: "US", area: "000", customers: 99 },
      { country: "CA", area: "M5V", customers: 40 },
    ];
    const inside = 1000 * c.shares["US:926"];
    assert.equal(townCustomers(c, counts), Math.round(inside));
    const usPeople = POSTAL_AREAS.filter((a) => a.country === "US").reduce((s, a) => s + a.population, 0);
    // Area 000 isn't a real area, so it's in neither the circle nor the total.
    const want = Math.round((inside / 1500 / (c.population / usPeople)) * 100) / 100;
    assert.equal(townLift(c, counts), want);
    assert.ok(want > 10, "a brand that big in Orange County is far over its share there");
  });

  it("has no lift for a brand with no customers in the country", async () => {
    const c = await townCircle(await town("San Clemente, CA"));
    const counts: AreaCount[] = [{ country: "CA", area: "M5V", customers: 40 }];
    assert.equal(townCustomers(c, counts), 0);
    assert.equal(townLift(c, counts), null);
  });
});

// ── The data stays on the server ───────────────────────────────────

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DATA = /data\/geo\/(places-[a-z]{2}|zip5)\.json/;

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** The files a module imports for real: not types, not import(). */
function imports(file: string): string[] {
  if (!/\.tsx?$/.test(file)) return [];
  const text = readFileSync(join(ROOT, file), "utf8");
  const out: string[] = [];
  for (const [, spec] of text.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
    const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(join(ROOT, file)), spec) : null;
    if (!base) continue;
    const hit = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find(
      (p) => existsSync(p) && statSync(p).isFile(),
    );
    if (hit) out.push(relative(ROOT, hit));
  }
  return out;
}

function reach(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) for (const next of imports(queue.shift()!)) if (!seen.has(next) && seen.add(next)) queue.push(next);
  return seen;
}

describe("the town data stays on the server", () => {
  it("loads only through lib/places/data.ts, with import()", () => {
    // Everything that ships; scripts/build-places.ts writes the files.
    const files = ["app", "components", "lib", "engine"].flatMap(sources);
    const users = files.filter((f) => DATA.test(readFileSync(join(ROOT, f), "utf8")));
    assert.deepEqual(users, ["lib/places/data.ts"]);
    for (const line of readFileSync(join(ROOT, "lib/places/data.ts"), "utf8").split("\n")) {
      if (DATA.test(line)) assert.match(line, /import\("\.\.\/\.\.\/data\/geo\/[a-z0-9-]+\.json"\)/, line);
    }
  });

  it("never reaches a browser bundle, a page, or the queue and campaign modules", () => {
    const pages = ["app", "components"].flatMap(sources);
    for (const file of pages) {
      assert.ok(!imports(file).some((f) => f.startsWith("lib/places/")), `${file} imports lib/places`);
    }
    const client = pages.filter((f) => /^["']use client["']/m.test(readFileSync(join(ROOT, f), "utf8")));
    assert.ok(client.includes("components/upload/UploadClient.tsx"));
    for (const start of [...client, "lib/mcp/campaign.ts", "lib/mcp/queue.ts"]) {
      const reached = [...reach(start)].filter((f) => f.startsWith("lib/places/"));
      assert.deepEqual(reached, [], `${start} reaches lib/places`);
    }
  });
});
