import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createWikidataClient, lookupQuery, parseLookup, WikidataBusy } from "./wikidata";

const fixture = JSON.parse(readFileSync(new URL("../__fixtures__/wikidata-seahawks.json", import.meta.url), "utf8"));

describe("Wikidata lookups", () => {
  it("finds Sam Darnold's high school and birthplace", () => {
    const found = parseLookup(fixture);
    assert.equal(found.length, 53, "53 of the 83 Seahawks are on Wikidata");
    assert.equal(found.filter((a) => a.school).length, 21);
    assert.deepEqual(
      found.find((a) => a.externalId === "3912547"),
      {
        externalId: "3912547",
        item: "Q27049069",
        school: { name: "San Clemente High School", lat: 33.4406, lng: -117.6159, country: "US" },
        birthplace: { name: "Capistrano Beach", lat: 33.463611111, lng: -117.678333333, country: "US" },
        sitelinks: 15,
      },
    );
  });

  it("takes the school nearest the birthplace when there's more than one", () => {
    const row = (school: string, coord: string) => ({
      espn: { value: "1" },
      item: { value: "http://www.wikidata.org/entity/Q1" },
      school: { value: `http://www.wikidata.org/entity/${school}` },
      schoolLabel: { value: school },
      schoolCoord: { value: coord },
      schoolCountry: { value: "http://www.wikidata.org/entity/Q30" },
      birth: { value: "http://www.wikidata.org/entity/Q9" },
      birthLabel: { value: "Atlanta" },
      birthCoord: { value: "Point(-84.39 33.75)" },
      birthCountry: { value: "http://www.wikidata.org/entity/Q16" },
    });
    const [a] = parseLookup({ results: { bindings: [row("Q2", "Point(-81.1 32.1)"), row("Q3", "Point(-84.3 33.8)")] } });
    assert.equal(a.school?.name, "Q3");
    assert.equal(a.birthplace?.country, "CA");
    assert.equal(a.sitelinks, null, "no count of pages in the answer");
  });

  it("asks for only digit ids, and says when Wikidata is busy", async () => {
    const q = lookupQuery("P3686", ["3912547", '1" } . ?x ?y ?z . { "', "4576297"]);
    assert.match(q, /VALUES \?espn \{ "3912547" "4576297" \}/);
    assert.match(q, /wdt:P3686 \?espn/);
    assert.match(q, /wikibase:sitelinks \?sitelinks/);
    assert.throws(() => lookupQuery("P1; DROP", ["1"]));

    const bodies: string[] = [];
    let status = 429;
    const client = createWikidataClient({
      fetchImpl: (async (_url: string, init: RequestInit) => {
        bodies.push(String(init.body));
        assert.match(String((init.headers as Record<string, string>)["user-agent"]), /^WalkoffEngine\/1\.0 \(https:\/\/www\.walkoff\.io\)$/);
        return status === 200
          ? new Response(JSON.stringify(fixture), { status })
          : new Response("slow down", { status, headers: { "retry-after": "120" } });
      }) as typeof fetch,
    });
    await assert.rejects(client.lookup("nfl", ["3912547"]), (e: unknown) => e instanceof WikidataBusy && e.retryAfter === 120);
    status = 200;
    assert.equal((await client.lookup("nfl", ["3912547"])).length, 53);
    assert.deepEqual(await client.lookup("ncaab", ["1"]), [], "no property for college basketball");
    assert.equal(bodies.length, 2);
  });
});
