import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { amount, contactDomain, domainOf, messagingApps, parseContacts, parseProspects, readCsv, type Row } from "./csv";

const rows = (headers: string[], ...values: string[][]): Row[] =>
  values.map((v) => Object.fromEntries(headers.map((h, i) => [h, v[i]])));

// Store Leads doesn't publish its export's headers, so both spellings are
// covered: the web export's and the API's field names.
const EXPORT = ["Domain", "Merchant Name", "Platform", "Country", "Region", "State", "City", "Estimated Monthly Sales", "Product Count", "Categories", "Apps"];
const API = ["name", "merchant_name", "platform", "country_code", "administrative_area_level_1", "city", "latitude", "longitude", "estimated_sales", "product_count", "apps"];

// Apollo's people export, trimmed.
const APOLLO = ["First Name", "Last Name", "Title", "Company", "Company Name for Emails", "Email", "Email Status", "Person Linkedin Url", "Website", "City", "State"];

describe("readCsv", () => {
  it("reads headers and rows, without Excel's byte-order mark", () => {
    const { headers, rows: data } = readCsv("﻿Domain,Merchant Name\nfrostbuddy.com,Frost Buddy\n\n");
    assert.deepEqual(headers, ["Domain", "Merchant Name"]);
    assert.deepEqual(data, [{ Domain: "frostbuddy.com", "Merchant Name": "Frost Buddy" }]);
  });
});

describe("domainOf", () => {
  it("keeps the host, lowercase and without www", () => {
    assert.equal(domainOf("https://www.FrostBuddy.com/collections/all?x=1"), "frostbuddy.com");
    assert.equal(domainOf("shop.example.co.uk"), "shop.example.co.uk");
    assert.equal(domainOf("acme.myshopify.com"), "acme.myshopify.com");
  });

  it("refuses what isn't a public host name", () => {
    for (const bad of ["", "Frost Buddy", "frostbuddy", "sam@frostbuddy.com", "192.168.1.10", "http://localhost:3000"]) {
      assert.equal(domainOf(bad), null, bad);
    }
  });
});

describe("amount", () => {
  it("reads money as exports write it", () => {
    assert.equal(amount("$1,234.50"), 1234.5);
    assert.equal(amount("12.5K"), 12500);
    assert.equal(amount("$1.2M"), 1_200_000);
    assert.equal(amount("830 USD"), 830);
    assert.equal(amount("n/a"), null);
  });
});

describe("parseProspects", () => {
  it("reads a Store Leads web export", () => {
    const { prospects, report } = parseProspects(
      EXPORT,
      rows(
        EXPORT,
        ["https://www.FrostBuddy.com/", "Frost Buddy", "Shopify", "United States", "Americas", "California", "San Clemente", "$1.2M", "312", "/Home & Garden/:/Sports/", "Klaviyo: Email Marketing & SMS:Postscript SMS Marketing"],
        ["frostbuddy.com", "Frost Buddy again", "shopify", "US", "Americas", "CA", "", "", "", "", ""],
        ["", "No Address Co", "shopify", "US", "", "TX", "Austin", "", "", "", ""],
      ),
    );
    assert.equal(prospects.length, 1);
    const p = prospects[0];
    assert.equal(p.domain, "frostbuddy.com");
    assert.equal(p.store_url, "https://frostbuddy.com");
    assert.equal(p.name, "Frost Buddy");
    assert.equal(p.platform, "shopify");
    assert.equal(p.country, "US");
    assert.equal(p.region, "CA");
    assert.equal(p.city, "San Clemente");
    assert.equal(p.monthly_sales, 1_200_000);
    assert.equal(p.product_count, 312);
    assert.deepEqual(p.categories, ["/Home & Garden/", "/Sports/"]);
    assert.deepEqual(messagingApps(p.apps), ["Klaviyo", "Postscript"]);
    assert.deepEqual(report.skipped, { "same store twice": 1, "no store address": 1 });
    assert.equal(report.kept, 1);
    assert.deepEqual(report.columns.region, ["State"]);
    assert.deepEqual(report.columns.region_fallback, ["Region"]);
  });

  it("reads the API's field names, where the domain is called name", () => {
    const { prospects } = parseProspects(
      API,
      rows(API, ["shop.example.com", "Sample Athleisure Co.", "shopify", "US", "California", "San Diego", "32.7157", "-117.1611", "48210.5", "86", "Klaviyo"]),
    );
    assert.equal(prospects[0].domain, "shop.example.com");
    assert.equal(prospects[0].name, "Sample Athleisure Co.");
    assert.equal(prospects[0].region, "CA");
    assert.deepEqual([prospects[0].lat, prospects[0].lng], [32.7157, -117.1611]);
    assert.equal(prospects[0].monthly_sales, 48210.5);
  });

  it("takes a continent-style region only when it names a state", () => {
    const headers = ["Domain", "Country", "Region"];
    const { prospects } = parseProspects(headers, rows(headers, ["a.com", "US", "Americas"], ["b.com", "US", "Ohio"]));
    assert.deepEqual(prospects.map((p) => p.region), [null, "OH"]);
  });

  it("reads a field from the column it's told to", () => {
    const headers = ["Domain", "HQ State Name", "Country"];
    const data = rows(headers, ["a.com", "Oregon", "US"]);
    assert.equal(parseProspects(headers, data, { columns: { region: "HQ State Name" } }).prospects[0].region, "OR");
    assert.throws(() => parseProspects(headers, data, { columns: { region: "State" } }), /no column named "State"/);
  });

  it("splits lists on the export's separator", () => {
    const headers = ["Domain", "Apps"];
    const { prospects } = parseProspects(headers, rows(headers, ["a.com", "Klaviyo: Email Marketing & SMS|Attentive"]), { separator: "|" });
    assert.deepEqual(prospects[0].apps, ["Klaviyo: Email Marketing & SMS", "Attentive"]);
  });
});

describe("parseContacts", () => {
  it("reads an Apollo export and drops addresses that won't arrive", () => {
    const { contacts, report } = parseContacts(
      APOLLO,
      rows(
        APOLLO,
        ["Sam", "Rivera", "Head of Retention", "Frost Buddy", "Frost Buddy", "Sam@FrostBuddy.com", "Verified", "http://www.linkedin.com/in/samrivera", "http://www.frostbuddy.com", "San Clemente", "California"],
        ["Ana", "Lee", "Founder", "Frost Buddy", "Frost Buddy", "ana@frostbuddy.com", "Unavailable", "", "frostbuddy.com", "", ""],
        ["Sam", "Rivera", "Head of Retention", "Frost Buddy", "Frost Buddy", "sam@frostbuddy.com", "Verified", "", "", "", ""],
        ["No", "Email", "CMO", "Acme", "Acme", "", "", "", "acme.com", "", ""],
      ),
    );
    assert.deepEqual(contacts, [
      {
        email: "sam@frostbuddy.com",
        domain: "frostbuddy.com",
        company: "Frost Buddy",
        name: "Sam Rivera",
        first_name: "Sam",
        title: "Head of Retention",
        linkedin: "http://www.linkedin.com/in/samrivera",
        email_status: "Verified",
      },
    ]);
    assert.deepEqual(report.skipped, { "address marked undeliverable": 1, "same person twice": 1, "no email address": 1 });
  });

  it("finds the company from a work address, never a Gmail one", () => {
    const headers = ["Name", "Email"];
    const { contacts } = parseContacts(headers, rows(headers, ["Jo Park", "jo@shop.example.com"], ["Al Ito", "al.ito@gmail.com"]));
    assert.deepEqual(contacts.map(contactDomain), ["shop.example.com", null]);
    assert.deepEqual(contacts.map((c) => c.first_name), ["Jo", "Al"]);
  });
});
