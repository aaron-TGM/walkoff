import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMember,
  brandsNamed,
  createBrand,
  DuplicateBrand,
  listMembers,
  newUploadToken,
  nextStep,
  normalizeEmail,
  onboardingStatus,
  removeMember,
  resolveBrand,
  siteOrigin,
  storeOrigin,
  updateBrand,
  uploadLink,
  welcomeFor,
  type OnboardingStatus,
} from "./brands";
import { fakeDb } from "./testing/fake-db";

const NOW = new Date("2026-10-23T12:00:00Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const grant = (email: string, kind: string, brandIds: string[] | null, over: Record<string, unknown> = {}) => ({
  token_hash: `${email}:${kind}:${Math.random()}`,
  kind,
  client_id: "claude",
  email,
  brand_ids: brandIds,
  scope: "walkoff",
  resource: "https://www.walkoff.io/mcp",
  expires_at: hoursFromNow(24),
  used_at: null,
  ...over,
});

function withEnv(name: string, value: string | undefined, fn: () => void) {
  const saved = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env[name];
    else process.env[name] = saved;
  }
}

describe("brand values", () => {
  it("keeps the store's https origin", () => {
    assert.equal(storeOrigin("frostbuddy.com"), "https://frostbuddy.com");
    assert.equal(storeOrigin(" https://www.FrostBuddy.com/collections/all?page=2 "), "https://www.frostbuddy.com");
    assert.throws(() => storeOrigin("http://frostbuddy.com"), /must be https/);
    assert.throws(() => storeOrigin("ftp://frostbuddy.com"), /must be https/);
    assert.throws(() => storeOrigin("frost buddy"), /isn't a web address/);
    assert.throws(() => storeOrigin("frostbuddy"), /isn't a web address/);
    assert.throws(() => storeOrigin("mailto:jane@frostbuddy.com"), /isn't a web address/);
  });

  it("lowercases emails and turns away anything else", () => {
    assert.equal(normalizeEmail("  Jane@FrostBuddy.com "), "jane@frostbuddy.com");
    assert.throws(() => normalizeEmail("jane"), /jane isn't an email address/);
    assert.throws(() => normalizeEmail("jane@frostbuddy"), /isn't an email address/);
    assert.throws(() => normalizeEmail(" "), /That isn't an email address/);
  });

  it("makes upload tokens the upload page accepts", () => {
    const token = newUploadToken();
    assert.match(token, /^[A-Za-z0-9_-]{24}$/);
    assert.notEqual(token, newUploadToken());
  });

  it("links to the www address unless this deployment says otherwise", () => {
    withEnv("WALKOFF_PUBLIC_URL", undefined, () => {
      assert.equal(siteOrigin(), "https://www.walkoff.io");
      assert.equal(uploadLink("tok"), "https://www.walkoff.io/upload/tok");
    });
    withEnv("WALKOFF_PUBLIC_URL", "http://localhost:3000/", () => assert.equal(uploadLink("tok"), "http://localhost:3000/upload/tok"));
    assert.equal(uploadLink("tok", "https://preview.example/"), "https://preview.example/upload/tok");
  });
});

describe("createBrand", () => {
  it("saves a tidy brand with its own upload token", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "  Frost   Buddy ", storeUrl: "frostbuddy.com/products/mitt", contactEmail: "Jane@FrostBuddy.com" });
    assert.equal(b.name, "Frost Buddy");
    assert.equal(b.store_url, "https://frostbuddy.com");
    assert.equal(b.contact_email, "jane@frostbuddy.com");
    assert.equal(b.licensed, false);
    assert.match(b.upload_token, /^[A-Za-z0-9_-]{24}$/);
    assert.equal(db.tables.brands.length, 1);
  });

  it("refuses a name that's taken, whatever the case or spacing, unless told to go ahead", async () => {
    const db = fakeDb();
    const first = await createBrand(db, { name: "Frost Buddy" });
    await assert.rejects(
      createBrand(db, { name: "frost  BUDDY" }),
      (err: unknown) => err instanceof DuplicateBrand && err.existing[0].id === first.id && /Frost Buddy already exists/.test(err.message),
    );
    assert.equal(db.tables.brands.length, 1);
    const second = await createBrand(db, { name: "frost buddy", allowDuplicate: true, licensed: true });
    assert.notEqual(second.upload_token, first.upload_token);
    assert.equal(second.licensed, true);
    assert.equal((await brandsNamed(db, "FROST BUDDY")).length, 2);
  });

  it("matches names exactly, so _ and % are just characters", async () => {
    const db = fakeDb();
    await createBrand(db, { name: "Frost_Buddy" });
    assert.equal((await brandsNamed(db, "Frost Buddy")).length, 0);
    assert.equal((await brandsNamed(db, "Frost%")).length, 0);
    await createBrand(db, { name: "Frost Buddy" });
  });

  it("checks the name, store and contact before saving anything", async () => {
    const db = fakeDb();
    await assert.rejects(createBrand(db, { name: "Frost Buddy", storeUrl: "http://frostbuddy.com" }), /https/);
    await assert.rejects(createBrand(db, { name: "Frost Buddy", contactEmail: "jane" }), /email/);
    await assert.rejects(createBrand(db, { name: "   " }), /name/);
    assert.equal((db.tables.brands ?? []).length, 0);
  });
});

describe("updateBrand", () => {
  it("changes the store and license", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy" });
    const u = await updateBrand(db, b.id, { storeUrl: "www.frostbuddy.com", licensed: true });
    assert.equal(u.store_url, "https://www.frostbuddy.com");
    assert.equal(u.licensed, true);
    assert.equal((await updateBrand(db, b.id, { licensed: false })).licensed, false);
  });

  it("renames, but not onto another brand's name", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "frost buddy" });
    await createBrand(db, { name: "Sun Buddy" });
    assert.equal((await updateBrand(db, b.id, { name: "Frost Buddy" })).name, "Frost Buddy");
    await assert.rejects(updateBrand(db, b.id, { name: "sun buddy" }), /Another brand is already named Sun Buddy/);
    await assert.rejects(updateBrand(db, b.id, {}), /Nothing to change/);
  });
});

describe("resolveBrand", () => {
  it("finds a brand by id, upload token or name", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy" });
    assert.equal((await resolveBrand(db, b.id)).id, b.id);
    assert.equal((await resolveBrand(db, b.upload_token)).id, b.id);
    assert.equal((await resolveBrand(db, " frost buddy ")).id, b.id);
  });

  it("says when a name is unknown or shared", async () => {
    const db = fakeDb();
    await createBrand(db, { name: "Frost Buddy" });
    await createBrand(db, { name: "Frost Buddy", allowDuplicate: true });
    await assert.rejects(resolveBrand(db, "Frost Buddy"), /More than one brand is named Frost Buddy; use its id/);
    await assert.rejects(resolveBrand(db, "Sun Buddy"), /No brand named Sun Buddy/);
    await assert.rejects(resolveBrand(db, ""), /Which brand/);
  });
});

describe("members", () => {
  it("adds people once, lowercased, and removes them", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy" });
    assert.deepEqual(await addMember(db, b.id, "Jane@FrostBuddy.com"), { email: "jane@frostbuddy.com", added: true });
    assert.deepEqual(await addMember(db, b.id, "jane@frostbuddy.com"), { email: "jane@frostbuddy.com", added: false });
    assert.equal(db.tables.brand_members.length, 1);
    await assert.rejects(addMember(db, b.id, "jane"), /isn't an email address/);
    assert.deepEqual(await removeMember(db, b.id, "JANE@frostbuddy.com"), { email: "jane@frostbuddy.com", removed: true });
    assert.deepEqual(await removeMember(db, b.id, "jane@frostbuddy.com"), { email: "jane@frostbuddy.com", removed: false });
  });

  it("counts someone as connected only with a live sign-in that reaches the brand", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy" });
    const other = await createBrand(db, { name: "Sun Buddy" });
    const people = ["live@x.com", "expired@x.com", "rotated@x.com", "elsewhere@x.com", "code@x.com", "never@x.com", "op@walkoff.io"];
    for (const email of people) await addMember(db, b.id, email);
    db.tables.oauth_grants = [
      grant("live@x.com", "refresh", [b.id]),
      grant("expired@x.com", "access", [b.id], { expires_at: hoursFromNow(-1) }),
      grant("rotated@x.com", "refresh", [b.id], { used_at: hoursFromNow(-2) }),
      grant("elsewhere@x.com", "access", [other.id]),
      grant("code@x.com", "code", [b.id]),
      grant("op@walkoff.io", "access", null),
    ];
    const members = new Map((await listMembers(db, b.id, NOW)).map((m) => [m.email, m]));
    assert.deepEqual([...members.keys()], people);
    assert.equal(members.get("live@x.com")?.connected, true);
    assert.equal(members.get("op@walkoff.io")?.connected, true);
    for (const email of ["expired@x.com", "rotated@x.com", "code@x.com", "never@x.com"]) {
      assert.equal(members.get(email)?.connected, false, email);
      assert.equal(members.get(email)?.needs_reconnect, undefined, email);
    }
    assert.equal(members.get("elsewhere@x.com")?.connected, false);
    assert.equal(members.get("elsewhere@x.com")?.needs_reconnect, true);
  });

  it("writes the welcome with this server's links", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy" });
    const other = await createBrand(db, { name: "Sun Buddy" });
    const w = await welcomeFor(db, b, "jane@frostbuddy.com", { invitedBy: "op@walkoff.io", origin: "http://localhost:3000", now: NOW });
    assert.deepEqual(w, {
      to: "jane@frostbuddy.com",
      brand: "Frost Buddy",
      invitedBy: "op@walkoff.io",
      uploadUrl: `http://localhost:3000/upload/${b.upload_token}`,
      connectorUrl: "http://localhost:3000/mcp",
      reconnect: false,
    });
    db.tables.oauth_grants = [grant("jane@frostbuddy.com", "refresh", [other.id])];
    assert.equal((await welcomeFor(db, b, "jane@frostbuddy.com", { now: NOW })).reconnect, true);
  });
});

describe("onboardingStatus", () => {
  it("reads each step from the brand's records", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy", storeUrl: "frostbuddy.com" });
    const other = await createBrand(db, { name: "Sun Buddy" });
    await addMember(db, b.id, "jane@frostbuddy.com");
    db.tables.brand_uploads = [
      { brand_id: b.id, format: "shopify_customers", customers: 7, created_at: "2026-10-01T10:00:00Z" },
      { brand_id: b.id, format: "shopify_orders", customers: 4210, created_at: "2026-10-20T10:00:00Z" },
      { brand_id: b.id, format: "shopify_products", customers: null, created_at: "2026-10-21T10:00:00Z" },
      { brand_id: other.id, format: "shopify_orders", customers: 99, created_at: "2026-10-22T10:00:00Z" },
    ];
    db.tables.affinity_reports = [
      { brand_id: b.id, created_at: "2026-10-20T10:00:01Z", report: { totals: { matchedCustomers: 7 }, standouts: [] } },
      {
        brand_id: b.id,
        created_at: "2026-10-21T10:00:01Z",
        report: {
          totals: { matchedCustomers: 4100, unmatchedCustomers: 110 },
          standouts: [
            { teamName: "Los Angeles Chargers", leagueName: "NFL" },
            { teamName: "USC Trojans", leagueName: "NCAA Football" },
            { teamName: "USC Trojans", leagueName: "NCAA Basketball" },
          ],
        },
      },
    ];
    db.tables.brand_products = [
      { brand_id: b.id, handle: "mitt", teams: [{ league: "nfl", teamId: "24" }], colorways: [{ name: "Azure" }, { name: "Gold" }], tagged_by: "claude" },
      { brand_id: b.id, handle: "hat", teams: [], colorways: [{ name: "Navy" }], tagged_by: "rules" },
      { brand_id: other.id, handle: "sun", teams: [], colorways: [], tagged_by: "claude" },
    ];
    db.tables.triggers = [
      { brand_id: b.id, active: true },
      { brand_id: b.id, active: false },
    ];
    db.tables.moments = [{ id: "m1", headline: "Chargers walk it off" }];
    db.tables.sends = [
      { brand_id: b.id, moment_id: "m1", status: "drafted", created_at: "2026-10-22T09:00:00Z" },
      { brand_id: b.id, moment_id: "m1", status: "skipped", created_at: "2026-10-22T11:00:00Z" },
    ];
    const s = await onboardingStatus(db, b.id, NOW);
    assert.equal(s.brand, "Frost Buddy");
    assert.equal(s.store_url, "https://frostbuddy.com");
    assert.deepEqual(s.members.map((m) => [m.email, m.connected]), [["jane@frostbuddy.com", false]]);
    assert.deepEqual(s.customers, { uploaded: 4210, file: "Shopify order export", at: "2026-10-20T10:00:00Z" });
    assert.deepEqual(s.map, {
      customers_mapped: 4100,
      not_placed: 110,
      standout_teams: ["Los Angeles Chargers (NFL)", "USC Trojans (NCAA Football)", "USC Trojans (NCAA Basketball)"],
      computed_at: "2026-10-21T10:00:01Z",
    });
    assert.deepEqual(s.catalog, {
      products: 2,
      colorways: 3,
      tagged_to_a_team: 1,
      tagged_by_claude: 1,
      tagged_by_rules: 1,
      claude_share: 0.5,
      uploaded_at: "2026-10-21T10:00:00Z",
    });
    assert.deepEqual(s.triggers, { active: 1, total: 2 });
    assert.deepEqual(s.last_send, { status: "drafted", at: "2026-10-22T09:00:00Z", moment: "Chargers walk it off" });
    assert.equal(s.next, `Tag the catalog with Claude: npm run affinity:tag -- --brand ${b.id}. 1 product has only rule-based tags.`);
  });

  it("starts with the operator's setup for a brand with nothing yet", async () => {
    const db = fakeDb();
    const b = await createBrand(db, { name: "Frost Buddy" });
    const s = await onboardingStatus(db, b.id, NOW);
    assert.deepEqual([s.members, s.customers, s.map, s.last_send], [[], null, null, null]);
    assert.deepEqual(s.catalog, { products: 0, colorways: 0, tagged_to_a_team: 0, tagged_by_claude: 0, tagged_by_rules: 0, claude_share: 0, uploaded_at: null });
    assert.match(s.next, /store's address/);
  });
});

describe("nextStep", () => {
  const ready: Omit<OnboardingStatus, "next"> = {
    brand: "Frost Buddy",
    id: "b1",
    created_at: "2026-10-01T00:00:00Z",
    store_url: "https://frostbuddy.com",
    licensed: false,
    members: [{ email: "jane@frostbuddy.com", invited_at: "2026-10-01T00:00:00Z", connected: true }],
    customers: { uploaded: 4210, file: "Shopify order export", at: "2026-10-20T10:00:00Z" },
    map: { customers_mapped: 4100, not_placed: 0, standout_teams: ["Los Angeles Chargers"], computed_at: "2026-10-20T10:00:01Z" },
    catalog: { products: 10, colorways: 30, tagged_to_a_team: 2, tagged_by_claude: 10, tagged_by_rules: 0, claude_share: 1, uploaded_at: "2026-10-21T10:00:00Z" },
    triggers: { active: 0, total: 0 },
    last_send: { status: "sent", at: "2026-10-22T09:00:00Z", moment: null },
  };
  const jane = ready.members[0];
  const steps = [
    nextStep({ ...ready, store_url: null, members: [] }),
    nextStep({ ...ready, members: [] }),
    nextStep({ ...ready, customers: null, map: null }),
    nextStep({ ...ready, map: { ...ready.map!, customers_mapped: 0 } }),
    nextStep({ ...ready, catalog: { ...ready.catalog, products: 0, tagged_by_claude: 0 } }),
    nextStep({ ...ready, catalog: { ...ready.catalog, tagged_by_claude: 7, tagged_by_rules: 3 } }),
    nextStep({ ...ready, members: [{ ...jane, connected: false }] }),
    nextStep({ ...ready, members: [{ ...jane, connected: false, needs_reconnect: true }] }),
    nextStep({ ...ready, last_send: null }),
    nextStep(ready),
  ];

  it("follows onboarding in order", () => {
    assert.match(steps[0], /^Add the store's address with update_brand/);
    assert.match(steps[1], /^Invite the brand's marketer with invite_member/);
    assert.match(steps[2], /^Waiting on jane@frostbuddy\.com to upload customers or orders/);
    assert.match(steps[3], /didn't place anyone in a postal area/);
    assert.match(steps[4], /^Waiting on the product export/);
    assert.match(steps[5], /npm run affinity:tag -- --brand b1\. 3 products have only rule-based tags\.$/);
    assert.match(steps[6], /^Waiting on jane@frostbuddy\.com to connect Walkoff in Claude/);
    assert.match(steps[7], /^jane@frostbuddy\.com signed in before this invite, so they need to disconnect Walkoff in Claude and connect it again to reach Frost Buddy\.$/);
    assert.match(steps[8], /^Ready for a first campaign/);
    assert.equal(steps[9], "Live. The last campaign was sent on 2026-10-22.");
  });

  it("names everyone it's waiting on", () => {
    const members = ["a@x.com", "b@x.com", "c@x.com"].map((email) => ({ ...jane, email, connected: false }));
    assert.match(nextStep({ ...ready, members }), /^Waiting on a@x\.com, b@x\.com and c@x\.com to connect/);
  });

  it("writes plain sentences without em dashes", () => {
    for (const s of steps) assert.ok(!/[—–]/.test(s), s);
  });
});
