import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POSTAL_AREAS } from "./geo";
import {
  apportion,
  buildAreaCounts,
  coarseArea,
  COUNT_LIMITS,
  customerCountsImport,
  parseCountLines,
  SHOPIFYQL,
  type AreaBuild,
  type CountLine,
} from "./shopify-counts";
import { parseCustomerUpload, UploadError } from "./validate";

const line = (country: string, key: string, customers: number): CountLine => ({ country, key, customers });

function refused(fn: () => unknown, message: RegExp) {
  assert.throws(fn, (err: unknown) => err instanceof UploadError && message.test(err.message));
}

/** What every build must hold, whatever went in. */
function holds(b: AreaBuild) {
  const keys = new Set(b.areas.map((a) => `${a.country}:${a.area}`));
  assert.equal(keys.size, b.areas.length, "one row per area");
  for (const a of b.areas) {
    assert.ok(Number.isInteger(a.customers) && a.customers > 0, `${a.country}:${a.area} ${a.customers}`);
  }
  const sum = b.areas.reduce((s, a) => s + a.customers, 0);
  assert.equal(sum, b.customers);
  assert.equal(b.customers, b.fromPostalCodes + b.spreadByRegion + b.spreadCountryWide);
  assert.equal(Object.values(b.byCountry).reduce((s, n) => s + (n ?? 0), 0), b.customers);
  // The upload API's own check: only coarse areas.
  parseCustomerUpload({ format: "counts_csv", areas: b.areas });
}

const inRegion = (b: AreaBuild, country: string, region: string) => {
  const codes = new Set(POSTAL_AREAS.filter((a) => a.country === country && a.region === region).map((a) => a.code));
  return b.areas.filter((a) => a.country === country && codes.has(a.area)).reduce((s, a) => s + a.customers, 0);
};

describe("the queries", () => {
  it("ask for counts only, in the countries Walkoff maps", () => {
    for (const q of Object.values(SHOPIFYQL)) {
      assert.match(q, /^FROM sales SHOW customers WHERE shipping_country_code IN \('US', 'CA', 'GB'\) AND shipping_postal_code IS NOT NULL GROUP BY /);
      assert.match(q, / SINCE -365d UNTIL today ORDER BY customers DESC LIMIT 1000$/);
      assert.doesNotMatch(q, /email|name|address|phone|TOP/i);
    }
    assert.match(SHOPIFYQL.postalCodes, /GROUP BY shipping_country_code, shipping_postal_code /);
    assert.match(SHOPIFYQL.regions, /GROUP BY shipping_country_code, shipping_region /);
  });
});

describe("parseCountLines", () => {
  it("reads rows however the query's output came", () => {
    const want = [line("US", "92101", 37), line("CA", "M5V 3L9", 1204)];
    const inputs = [
      "shipping_country_code,shipping_postal_code,customers\nUS,92101,37\n\nCA,M5V 3L9,1204\n",
      "country\tpostal code\tcustomers\nUS\t92101\t37\nCA\tM5V 3L9\t1204",
      '"US","92101","37"\r\n"CA","M5V 3L9","1,204"',
      "US, 92101, 37\nCA, M5V 3L9, 1,204",
      "| shipping_country_code | shipping_postal_code | customers |\n|---|:---:|---:|\n| US | 92101 | 37 |\n| CA | M5V 3L9 | 1204 |",
      "Top postal codes, last 365 days:\nUS,92101,37.0\nCA,M5V 3L9,1204\nUS,10001,0",
    ];
    for (const text of inputs) assert.deepEqual(parseCountLines(text, "postal"), { lines: want, unreadable: 0 }, text);
  });

  it("reads a UK total with no region, and counts rows it can't read", () => {
    assert.deepEqual(parseCountLines("GB,,312\nGB,88\nUS,Texas,lots\nUS,Ohio,4.5", "region"), {
      lines: [line("GB", "", 312), line("GB", "", 88)],
      unreadable: 2,
    });
  });

  it("refuses anything that looks like more than counts, without echoing it", () => {
    refused(() => parseCountLines("US,92101,37\njane@frostbuddy.com,92101,1", "postal"), /include an email address\. Walkoff takes counts only/);
    const address = "US,92101,37\nJane Doe,1 Main St,San Diego,92101,1";
    refused(() => parseCountLines(address, "postal"), /^Line 2 of postal_codes has more than three parts\. Each row takes three parts: country, postal code and customers, like US,92101,37\.$/);
    refused(() => parseCountLines(`US,${"9".repeat(61)},1`, "postal"), /^Line 1 of postal_codes is too long\./);
    refused(() => parseCountLines("US,92101,37\n".repeat(COUNT_LIMITS.lines + 1), "postal"), /has more than 5,000 rows/);
    refused(() => parseCountLines("country,region,customers\n", "region"), /^Walkoff couldn't read any rows in regions\. Each row takes three parts: country, state or province, and customers, like US,California,1204\.$/);
    for (const bad of [address, `US,${"9".repeat(61)},1`]) {
      try {
        parseCountLines(bad, "postal");
      } catch (err) {
        assert.doesNotMatch((err as Error).message, /Jane|Main|9{6}/);
      }
    }
  });
});

describe("coarseArea", () => {
  it("keeps the area, never the code", () => {
    const cases: [string, string, string | null][] = [
      ["US", "92101", "921"],
      ["US", "92101-1234", "921"],
      ["US", "921011234", "921"],
      ["US", "02035", "020"],
      ["US", "2035", "020"],
      ["US", "921", "921"],
      ["US", "00921", "009"],
      ["CA", "M5V 3L9", "M5V"],
      ["CA", "m5v3l9", "M5V"],
      ["CA", "M5V", "M5V"],
      ["GB", "N17 0AP", "N17"],
      ["GB", "n170ap", "N17"],
      ["GB", "N17", "N17"],
      ["GB", "SW1A 1AA", "SW1A"],
      ["GB", "W1A 0AX", "W1A"],
      ["US", "001", null],
      ["US", "12345 Main St", null],
      ["US", "1234-5678", null],
      ["US", "M5V 3L9", null],
      ["CA", "92101", null],
      ["GB", "Tottenham", null],
      ["US", "", null],
    ];
    for (const [country, raw, want] of cases) assert.equal(coarseArea(country as "US" | "CA" | "GB", raw), want, `${country} ${raw}`);
  });
});

describe("apportion", () => {
  it("adds up exactly, in whole numbers", () => {
    assert.deepEqual(apportion(10, [1, 1, 1]), [4, 3, 3]);
    assert.deepEqual(apportion(1, [5, 9, 9]), [0, 1, 0], "a tie goes to the earlier of the largest");
    assert.deepEqual(apportion(2, [0, 0]), [1, 1], "no weights means equal shares");
    assert.deepEqual(apportion(0, [3, 4]), [0, 0]);
    assert.deepEqual(apportion(5, []), []);
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < 200; t++) {
      const weights = Array.from({ length: 1 + Math.floor(rand() * 40) }, () => Math.floor(rand() * 100_000));
      const total = Math.floor(rand() * 5000);
      const out = apportion(total, weights);
      assert.equal(out.reduce((s, n) => s + n, 0), total);
      const sum = weights.reduce((s, w) => s + w, 0);
      out.forEach((n, i) => {
        assert.ok(Number.isInteger(n) && n >= 0);
        const quota = sum ? (total * weights[i]) / sum : total / weights.length;
        assert.ok(Math.abs(n - quota) < 1, `${n} vs ${quota}`);
      });
    }
  });
});

describe("buildAreaCounts", () => {
  it("merges codes in the same area", () => {
    const b = buildAreaCounts({ postal: [line("US", "92101", 30), line("US", "92108", 12), line("USA", "92103-4410", 1)] });
    holds(b);
    assert.deepEqual(b.areas, [{ country: "US", area: "921", customers: 43, orders: 0, revenue: 0 }]);
    assert.deepEqual([b.coverage, b.regionTotal, b.spreadByRegion], [null, null, 0], "no totals, no spreading");
  });

  it("spreads a state's other customers over that state only", () => {
    const b = buildAreaCounts({
      postal: [line("US", "92101", 40), line("US", "19147", 25)],
      regions: [line("US", "California", 100), line("US", "Pennsylvania", 25)],
    });
    holds(b);
    assert.equal(inRegion(b, "US", "CA"), 100);
    assert.equal(inRegion(b, "US", "PA"), 25);
    assert.equal(b.customers, 125);
    assert.deepEqual([b.fromPostalCodes, b.spreadByRegion, b.spreadCountryWide, b.overCounted], [65, 60, 0, 0]);
    assert.equal(b.coverage, 0.52);
    const sd = b.areas.find((a) => a.area === "921")!;
    assert.ok(sd.customers > 40, "San Diego also gets its share of the rest");
  });

  it("never takes from codes when they add up to more than the state", () => {
    const b = buildAreaCounts({ postal: [line("US", "92101", 50)], regions: [line("US", "CA", 45)] });
    holds(b);
    assert.deepEqual(b.areas, [{ country: "US", area: "921", customers: 50, orders: 0, revenue: 0 }]);
    assert.equal(b.overCounted, 5);
  });

  it("spreads a country with no codes in the top rows by province", () => {
    const b = buildAreaCounts({
      postal: [line("US", "92101", 10)],
      regions: [line("US", "California", 10), line("CA", "Ontario", 300), line("CA", "Québec", 100)],
    });
    holds(b);
    assert.equal(inRegion(b, "CA", "ON"), 300);
    assert.equal(inRegion(b, "CA", "QC"), 100);
    assert.equal(b.byCountry.CA, 400);
  });

  it("spreads the UK, and names it can't match, over the whole country", () => {
    const b = buildAreaCounts({
      postal: [line("GB", "N17 0AP", 100), line("US", "92101", 40)],
      regions: [line("GB", "", 300), line("US", "Californie", 100), line("US", "Armed Forces Europe", 12)],
    });
    holds(b);
    assert.equal(b.byCountry.GB, 300);
    assert.ok(b.areas.find((a) => a.area === "N17")!.customers >= 100);
    // 112 unmatched, less the 40 already placed in California: 72 spread
    // across the US, not piled into one state.
    assert.equal(b.byCountry.US, 112);
    assert.equal(b.spreadCountryWide, 200 + 72);
    assert.ok(new Set(b.areas.filter((a) => a.country === "US").map((a) => POSTAL_AREAS.find((p) => p.key === `US:${a.area}`)!.region)).size > 10);
    assert.deepEqual(b.regionsNotMatched, ["Californie", "Armed Forces Europe"]);
  });

  it("skips codes it can't place, and takes the columns either way round", () => {
    const b = buildAreaCounts({
      postal: [line("92101", "US", 5), line("FR", "75001", 9), line("US", "09012", 3), line("US", "Main St", 2)],
      regions: [line("FR", "Paris", 9)],
    });
    holds(b);
    assert.deepEqual(b.areas, [{ country: "US", area: "921", customers: 5, orders: 0, revenue: 0 }]);
    assert.deepEqual(b.skipped, { otherCountries: 2, unknownAreas: 2 });
    assert.equal(b.regionTotal, 0);
  });

  it("holds up on a large, messy store", () => {
    const us = POSTAL_AREAS.filter((a) => a.country === "US");
    const postal = us.slice(0, 700).map((a, i) => line("US", a.ref, 1 + ((i * 7919) % 300)));
    const ca = POSTAL_AREAS.filter((a) => a.country === "CA").slice(0, 300);
    postal.push(...ca.map((a, i) => line("CA", a.ref, 1 + (i % 9))));
    const states = new Map<string, number>();
    for (const l of postal.slice(0, 700)) {
      const r = us.find((a) => a.ref === l.key)!.region;
      states.set(r, (states.get(r) ?? 0) + Math.round(l.customers * 2.2));
    }
    const regions = [...states].map(([r, n]) => line("US", r, n));
    regions.push(line("CA", "Ontario", 5000), line("GB", "", 800), line("US", "Guam", 4));
    const b = buildAreaCounts({ postal, regions });
    holds(b);
    assert.ok(b.coverage! > 0.3 && b.coverage! < 0.6, String(b.coverage));
  });
});

describe("customerCountsImport", () => {
  const postal = "country,postal code,customers\nUS,92101,40\nUS,92108,12\nCA,M5V 3L9,9\nGB,N17 0AP,5";
  const regions = "country,region,customers\nUS,California,55\nCA,Ontario,9\nGB,,5";

  it("gives an upload of coarse counts", () => {
    const { upload, build, notes, unreadable } = customerCountsImport({ postalCodes: postal, regions });
    assert.equal(upload.format, "counts_csv");
    assert.deepEqual(upload.products, []);
    assert.equal(upload.rows, 7);
    assert.equal(upload.skipped, 0);
    assert.equal(build.customers, 69);
    assert.equal(unreadable, 0);
    assert.deepEqual(notes, []);
    const stored = JSON.stringify(upload);
    for (const code of ["92101", "92108", "M5V 3L9", "N17 0AP"]) assert.ok(!stored.includes(code), code);
  });

  it("says what's missing when the map leans on spreading", () => {
    assert.match(customerCountsImport({ postalCodes: postal }).notes[0], /^Without the second query's state and province totals/);
    const few = customerCountsImport({ postalCodes: "US,92101,10", regions: "US,California,100" });
    assert.deepEqual(few.notes, ["Only 1 postal code rows came through, for 10% of customers. If the first query returned more, pass all of them in one call."]);
  });

  it("refuses swapped inputs and codes it can't map", () => {
    refused(() => customerCountsImport({ postalCodes: regions, regions: postal }), /^The rows look swapped\./);
    refused(() => customerCountsImport({ postalCodes: postal, regions: postal }), /^The rows look swapped\./);
    refused(() => customerCountsImport({ postalCodes: "FR,75001,9\nDE,10115,4" }), /^None of these postal codes are in an area Walkoff maps/);
  });
});
