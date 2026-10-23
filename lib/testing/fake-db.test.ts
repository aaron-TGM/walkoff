import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fakeDb } from "./fake-db";

describe("fakeDb", () => {
  it("knows the tables and columns from the migrations", async () => {
    const db = fakeDb({ brands: [{ id: "b1", name: "Frost Buddy", report: null }] });
    assert.deepEqual((await db.from("brands").select("id, store_url").eq("licensed", false)).error, null);
    assert.equal((await db.from("brands").select("id, nmae")).error?.message, "column brands.nmae does not exist");
    assert.equal((await db.from("brand_members").select("email").eq("brand", "b1")).error?.message, "column brand_members.brand does not exist");
    assert.equal((await db.from("brand_member").select("email")).error?.message, 'relation "public.brand_member" does not exist');
    assert.equal((await db.from("brands").update({ licenced: true }).eq("id", "b1")).error?.message, "column brands.licenced does not exist");
    assert.equal((await db.from("affinity_reports").select("totals:reports->totals")).error?.message, "column affinity_reports.reports does not exist");
  });
});
