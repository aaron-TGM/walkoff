import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb } from "./testing/fake-db";
import { ATTRIBUTION_KEYS, cleanAttribution, insertSignup, sourceLines } from "./waitlist";

const ROW = { company: "Sample Athleisure Co.", email: "sam@example.com", role: "Brand", platform: "Klaviyo" };

/** The waitlist table before 008_waitlist_attribution.sql: inserting a column
 *  it doesn't have fails the way PostgREST does. */
function before008(code = "PGRST204") {
  const rows: Record<string, unknown>[] = [];
  let attempts = 0;
  const db = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        attempts++;
        const missing = Object.keys(row).find((k) => (ATTRIBUTION_KEYS as readonly string[]).includes(k));
        if (missing) return { data: null, error: { code, message: `Could not find the '${missing}' column of 'waitlist' in the schema cache` } };
        rows.push(row);
        return { data: null, error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, rows, attempts: () => attempts };
}

describe("waitlist attribution", () => {
  it("keeps only the known keys, trimmed and capped, and never an email address", () => {
    assert.deepEqual(
      cleanAttribution({
        utm_source: "  linkedin ",
        utm_campaign: "x".repeat(400),
        utm_content: "sam@brand.com",
        referrer: 42,
        landing_path: "/",
        cta_placement: "hero",
        email: "sam@brand.com",
      }),
      { utm_source: "linkedin", utm_campaign: "x".repeat(300), landing_path: "/", cta_placement: "hero" },
    );
    assert.deepEqual(cleanAttribution(null), {});
    assert.deepEqual(cleanAttribution("utm_source=linkedin"), {});
  });

  it("says in the signup email where a request came from", () => {
    assert.deepEqual(
      sourceLines({ utm_source: "linkedin", utm_medium: "social", utm_campaign: "fall", utm_term: "chargers", referrer: "www.linkedin.com", landing_path: "/", cta_placement: "hero" }),
      ["Campaign: linkedin / social / fall (term chargers)", "Came from: www.linkedin.com", "Landed on: /", "Clicked: the hero button"],
    );
    assert.deepEqual(sourceLines({ landing_path: "/help/klaviyo" }), ["Landed on: /help/klaviyo"]);
    assert.deepEqual(sourceLines({}), ["Source: not recorded"]);
    for (const line of sourceLines({ utm_source: "a", utm_content: "b", referrer: "c", landing_path: "/", cta_placement: "nav" })) {
      assert.ok(!/[—–]/.test(line), line);
    }
  });

  it("saves where a request came from once the columns exist", async () => {
    const db = fakeDb({ waitlist: [] });
    const result = await insertSignup(db, ROW, { utm_source: "linkedin", landing_path: "/", cta_placement: "pricing" });
    assert.deepEqual(result, { error: null, missingColumns: false });
    assert.equal(db.tables.waitlist.length, 1);
    assert.equal(db.tables.waitlist[0].utm_source, "linkedin");
    assert.equal(db.tables.waitlist[0].cta_placement, "pricing");
  });

  it("still saves the request before 008 has run, and says the source wasn't saved", async () => {
    for (const code of ["PGRST204", "42703"]) {
      const old = before008(code);
      const result = await insertSignup(old.db, ROW, { utm_source: "linkedin", landing_path: "/" });
      assert.deepEqual(result, { error: null, missingColumns: true });
      assert.equal(old.attempts(), 2);
      assert.deepEqual(old.rows, [ROW]);
    }
  });

  it("inserts once when there's no source to save", async () => {
    const old = before008();
    assert.deepEqual(await insertSignup(old.db, ROW, {}), { error: null, missingColumns: false });
    assert.equal(old.attempts(), 1);
  });

  it("doesn't retry other errors", async () => {
    let attempts = 0;
    const db = {
      from: () => ({
        insert: async () => {
          attempts++;
          return { data: null, error: { code: "23502", message: 'null value in column "email" violates not-null constraint' } };
        },
      }),
    } as unknown as SupabaseClient;
    const result = await insertSignup(db, ROW, { landing_path: "/" });
    assert.equal(result.error?.code, "23502");
    assert.equal(result.missingColumns, false);
    assert.equal(attempts, 1);
  });
});
