import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { noDb } from "../testing/fake-db";
import { createWalkoffServer } from "./server";

describe("get_territory", () => {
  it("hands Claude the team's segment, ready for Klaviyo's create_segment", async () => {
    // No brands: the tool still answers for a named team, without the database.
    const server = createWalkoffServer({
      db: noDb,
      principal: { email: "jane@frostbuddy.com", brandIds: [], clientId: "claude", scope: "walkoff" },
      now: () => new Date("2026-10-23T12:00:00Z"),
      origin: "https://www.walkoff.io",
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1.0.0" });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    const r = (await client.callTool({ name: "get_territory", arguments: { team: "Chargers", league: "nfl" } })) as CallToolResult;
    assert.ok(!r.isError);
    const out = JSON.parse(r.content.map((c) => (c.type === "text" ? c.text : "")).join(""));
    assert.equal(out.klaviyo_segment.name, "Walkoff · Los Angeles Chargers fans");
    const [condition] = out.klaviyo_segment.definition.condition_groups[0].conditions;
    assert.equal(condition.type, "profile-postal-code-distance");
    assert.equal(condition.country_code, "USA");
    assert.equal(condition.postal_code, out.circles[0].postal_code);
    assert.ok(out.klaviyo_segment_steps.length, "and the steps, for doing it by hand");
    await client.close();
  });
});
