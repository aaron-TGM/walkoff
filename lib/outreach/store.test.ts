import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fakeDb } from "../testing/fake-db";
import type { ContactRow } from "./csv";
import type { PitchPage } from "./pitch";
import type { ScoreResult } from "./score";
import {
  addContacts,
  addDoNotContact,
  blockedBy,
  contactsFor,
  createOutreach,
  listProspects,
  newPitchToken,
  outreachByToken,
  prospectByDomain,
  recordView,
  saveScore,
  setOutreachStatus,
  tokenOf,
  upsertProspects,
  type NewProspect,
} from "./store";

const prospect = (domain: string, o: Partial<NewProspect> = {}): NewProspect => ({
  domain,
  name: `${domain} Co`,
  store_url: `https://${domain}`,
  platform: "shopify",
  country: "US",
  city: "San Diego",
  region: "CA",
  postal_code: null,
  lat: 32.7,
  lng: -117.2,
  monthly_sales: 40000,
  product_count: 80,
  categories: ["/Apparel/"],
  apps: ["Klaviyo"],
  home_area: "US:921",
  home_teams: [{ key: "nfl:24", name: "Los Angeles Chargers", share: 1 }],
  ...o,
});

const score = (verdict: "qualified" | "skipped", value: number): ScoreResult => ({
  verdict,
  score: value,
  best: verdict === "qualified" ? { key: "nfl:24", name: "Los Angeles Chargers", share: 1, score: value, picks: [] } : null,
  teams: [],
  products: 12,
  colorways: 30,
  reason: "because",
});

const contact = (email: string, o: Partial<ContactRow> = {}): ContactRow => ({
  email,
  domain: null,
  company: null,
  name: "Sam Rivera",
  first_name: "Sam",
  title: "Founder",
  linkedin: null,
  email_status: "verified",
  ...o,
});

describe("prospects", () => {
  it("adds stores, then refreshes them without erasing what a blank cell leaves out", async () => {
    const db = fakeDb();
    assert.deepEqual(await upsertProspects(db, [prospect("a.com"), prospect("b.com")]), { added: 2, updated: 0 });
    await saveScore(db, (await prospectByDomain(db, "a.com"))!.id, score("qualified", 0.8));
    assert.deepEqual(await upsertProspects(db, [prospect("a.com", { city: null, apps: [], monthly_sales: 52000 })]), { added: 0, updated: 1 });
    const a = (await prospectByDomain(db, "a.com"))!;
    assert.deepEqual([a.city, a.apps, a.monthly_sales], ["San Diego", ["Klaviyo"], 52000]);
    assert.deepEqual([a.status, a.score, a.best_team], ["qualified", 0.8, "nfl:24"], "a refresh keeps the score");
    assert.equal(db.tables.prospects.length, 2);
  });

  it("scores only stores nobody has written to", async () => {
    const db = fakeDb();
    await upsertProspects(db, [prospect("a.com")]);
    const a = (await prospectByDomain(db, "a.com"))!;
    db.tables.prospects[0].status = "contacted";
    await saveScore(db, a.id, score("skipped", 0.2));
    assert.equal((await prospectByDomain(db, "a.com"))!.status, "contacted");
  });

  it("lists qualified stores best first", async () => {
    const db = fakeDb();
    await upsertProspects(db, [prospect("a.com"), prospect("b.com"), prospect("c.com")]);
    for (const [domain, s] of [["a.com", 0.65], ["b.com", 0.9], ["c.com", 0.1]] as const) {
      await saveScore(db, (await prospectByDomain(db, domain))!.id, score(s >= 0.6 ? "qualified" : "skipped", s));
    }
    assert.deepEqual((await listProspects(db, { status: "qualified" })).map((p) => p.domain), ["b.com", "a.com"]);
  });
});

describe("addContacts", () => {
  it("files people under their company's prospect, by its domain or a work address", async () => {
    const db = fakeDb();
    await upsertProspects(db, [prospect("frostbuddy.com")]);
    const first = await addContacts(db, [
      contact("sam@frostbuddy.com", { domain: "frostbuddy.com" }),
      contact("ana@frostbuddy.com"),
      contact("jo@elsewhere.com"),
      contact("al@gmail.com", { company: "Frost Buddy" }),
    ], "apollo");
    assert.equal(first.saved, 2);
    assert.deepEqual(first.unmatched.map((c) => c.email), ["jo@elsewhere.com", "al@gmail.com"]);
    await addContacts(db, [contact("sam@frostbuddy.com", { domain: "frostbuddy.com", title: "CEO" })], "apollo");
    const saved = await contactsFor(db, (await prospectByDomain(db, "frostbuddy.com"))!.id);
    assert.deepEqual(saved.map((c) => [c.email, c.title, c.source]), [["sam@frostbuddy.com", "CEO", "apollo"], ["ana@frostbuddy.com", "Founder", "apollo"]]);
  });
});

describe("do not contact", () => {
  it("rules out an address, or a whole domain", async () => {
    const db = fakeDb();
    await addDoNotContact(db, ["Sam@FrostBuddy.com", "acme.com"], "asked");
    assert.deepEqual(await blockedBy(db, ["sam@frostbuddy.com", "frostbuddy.com"]), ["sam@frostbuddy.com"]);
    assert.deepEqual(await blockedBy(db, ["jo@acme.com", "acme.com"]), ["acme.com"]);
    assert.deepEqual(await blockedBy(db, []), []);
  });
});

describe("pitches", () => {
  async function setup() {
    const db = fakeDb();
    await upsertProspects(db, [prospect("frostbuddy.com")]);
    const p = (await prospectByDomain(db, "frostbuddy.com"))!;
    await saveScore(db, p.id, score("qualified", 0.8));
    await addContacts(db, [contact("sam@frostbuddy.com")], "apollo");
    const [c] = await contactsFor(db, p.id);
    const o = await createOutreach(db, {
      prospect_id: p.id,
      contact_id: c.id,
      token: newPitchToken(),
      team_key: "nfl:24",
      moment_id: null,
      moment_type: "team_win",
      campaign: { subject: "Azure and sunflower kind of Sunday." } as PitchPage,
      subject: "Your Chargers email",
      body: "Hi Sam",
    });
    return { db, p, o };
  }

  it("finds a pitch by the token in its link", async () => {
    const { db, o } = await setup();
    assert.equal(o.token.length, 24);
    assert.equal(tokenOf(`https://www.walkoff.io/p/${o.token}?preview=1`), o.token);
    assert.equal((await outreachByToken(db, o.token))?.id, o.id);
    assert.equal(await outreachByToken(db, "nope"), null);
    assert.equal(tokenOf("https://www.walkoff.io/p/short"), null);
  });

  it("counts views, keeping the first", async () => {
    const { db, o } = await setup();
    assert.equal(await recordView(db, o.token, new Date("2026-10-26T16:00:00Z")), true);
    assert.equal(await recordView(db, o.token, new Date("2026-10-26T17:00:00Z")), true);
    assert.equal(await recordView(db, "x".repeat(24)), false);
    const seen = (await outreachByToken(db, o.token))!;
    assert.deepEqual([seen.views, seen.first_viewed_at, seen.last_viewed_at], [2, "2026-10-26T16:00:00.000Z", "2026-10-26T17:00:00.000Z"]);
  });

  it("moves the prospect along as the pitch goes out and gets an answer", async () => {
    const { db, o } = await setup();
    await setOutreachStatus(db, o, "sent", new Date("2026-10-26T16:00:00Z"));
    assert.equal((await prospectByDomain(db, "frostbuddy.com"))!.status, "contacted");
    assert.equal((await outreachByToken(db, o.token))!.sent_at, "2026-10-26T16:00:00.000Z");
    await setOutreachStatus(db, o, "replied");
    assert.equal((await prospectByDomain(db, "frostbuddy.com"))!.status, "replied");
  });

  it("never writes to someone who unsubscribed again", async () => {
    const { db, o } = await setup();
    await setOutreachStatus(db, o, "unsubscribed");
    assert.deepEqual(await blockedBy(db, ["sam@frostbuddy.com"]), ["sam@frostbuddy.com"]);
  });
});
