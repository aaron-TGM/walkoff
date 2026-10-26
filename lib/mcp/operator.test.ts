import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fakeDb, noDb } from "../testing/fake-db";
import type { Principal } from "./data";
import { createWalkoffServer, OPERATOR_INSTRUCTIONS, SERVER_INFO } from "./server";
import { registerOperatorTools, type ToolContext } from "./tools";

process.env.WALKOFF_OPERATOR_EMAILS = "op@walkoff.io, second@walkoff.io";
delete process.env.RESEND_API_KEY;

const OPERATOR_TOOLS = [
  "create_brand",
  "update_brand",
  "invite_member",
  "list_members",
  "remove_member",
  "onboarding_status",
  "set_athlete_home",
  "record_athlete_rights",
  "create_moment",
  "retract_moment",
  "exclude_athlete",
];
const ORIGIN = "https://www.walkoff.io";
const NOW = new Date("2026-10-23T12:00:00Z");

const principal = (email: string, brandIds: string[] | null): Principal => ({ email, brandIds, clientId: "claude", scope: "walkoff" });
const operator = principal("op@walkoff.io", null);
const member = principal("jane@frostbuddy.com", ["7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10"]);
const ctxFor = (p: Principal, db: SupabaseClient = noDb): ToolContext => ({ db, principal: p, now: () => NOW, origin: ORIGIN });

async function connect(server: McpServer): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return { isError: r.isError === true, text, json: () => JSON.parse(text) };
}

const toolNames = async (client: Client) => (await client.listTools()).tools.map((t) => t.name);

// Arguments each tool accepts, so a refusal can't be put down to bad input.
const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  create_brand: { name: "Frost Buddy" },
  update_brand: { brand: "Frost Buddy", licensed: true },
  invite_member: { brand: "Frost Buddy", email: "bob@frostbuddy.com" },
  list_members: { brand: "Frost Buddy" },
  remove_member: { brand: "Frost Buddy", email: "bob@frostbuddy.com" },
  onboarding_status: {},
  set_athlete_home: { athlete: "Sam Darnold", hometown: "San Clemente, CA", note: "His Wikipedia page" },
  record_athlete_rights: { brand: "Frost Buddy", athlete: "Sam Darnold", starts_on: "2026-01-01", ends_on: "2026-12-31", evidence: "NIL agreement 2026-014" },
  create_moment: { athlete: "Griffin Colapinto", event: "WSL Finals", date: "2026-09-10", note: "worldsurfleague.com", sport: "surfing", hometown: "San Clemente, CA" },
  retract_moment: { moment_id: "8c1f2d3e-0000-4000-8000-000000000001", reason: "Wrong town" },
  exclude_athlete: { athlete: "Sam Darnold", note: "His agent, by email" },
};

describe("operator tools", () => {
  it("aren't listed or callable for a brand's members", async () => {
    const client = await connect(createWalkoffServer(ctxFor(member)));
    const names = await toolNames(client);
    assert.ok(names.includes("list_brands"));
    for (const name of OPERATOR_TOOLS) {
      assert.ok(!names.includes(name), `${name} is listed`);
      const r = await call(client, name, SAMPLE_ARGS[name]);
      assert.ok(r.isError, `${name} ran`);
      assert.match(r.text, new RegExp(`Tool ${name} not found`));
    }
    assert.ok(!client.getInstructions()?.includes("create_brand"));
    await client.close();
  });

  it("need an operator's address and access to every brand", async () => {
    const others = [
      principal("op@walkoff.io", ["7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10"]),
      principal("op@walkoff.io", []),
      principal("jane@frostbuddy.com", null),
    ];
    for (const p of others) {
      const client = await connect(createWalkoffServer(ctxFor(p)));
      const names = await toolNames(client);
      for (const name of OPERATOR_TOOLS) assert.ok(!names.includes(name), `${p.email} ${JSON.stringify(p.brandIds)} sees ${name}`);
      await client.close();
    }
  });

  it("are listed for operators, marked read-only or destructive as they are", async () => {
    const client = await connect(createWalkoffServer(ctxFor(principal("Second@Walkoff.io", null))));
    const tools = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
    for (const name of OPERATOR_TOOLS) assert.ok(tools.has(name), `${name} is missing`);
    const hints = (name: string) => tools.get(name)?.annotations ?? {};
    for (const name of ["list_members", "onboarding_status"]) assert.equal(hints(name).readOnlyHint, true, name);
    for (const name of ["create_brand", "invite_member"]) {
      assert.equal(hints(name).readOnlyHint, false, name);
      assert.equal(hints(name).destructiveHint, false, name);
    }
    for (const name of ["update_brand", "remove_member", "set_athlete_home", "record_athlete_rights", "retract_moment", "exclude_athlete"]) {
      assert.equal(hints(name).readOnlyHint, false, name);
      assert.equal(hints(name).destructiveHint, true, name);
    }
    assert.equal(hints("invite_member").openWorldHint, true, "it emails someone outside Walkoff");
    assert.ok(client.getInstructions()?.endsWith(OPERATOR_INSTRUCTIONS));
    await client.close();
  });

  it("check again in the handler, so registering them by mistake still refuses", async () => {
    const server = new McpServer(SERVER_INFO);
    // noDb fails any database call, which would show as a different error.
    registerOperatorTools(server, ctxFor(member));
    const client = await connect(server);
    for (const name of OPERATOR_TOOLS) {
      const r = await call(client, name, SAMPLE_ARGS[name]);
      assert.ok(r.isError, `${name} ran`);
      assert.equal(r.text, "Only Walkoff operators can do that.", name);
    }
    await client.close();
  });
});

describe("onboarding a brand from Claude", () => {
  it("creates the brand, invites its marketer and reports where it is", async (t) => {
    const log = t.mock.method(console, "log", () => {});
    const db = fakeDb();
    const client = await connect(createWalkoffServer(ctxFor(operator, db)));

    const created = await call(client, "create_brand", { name: "Frost Buddy", store_url: "frostbuddy.com", licensed: false });
    assert.ok(!created.isError, created.text);
    const brand = db.tables.brands[0];
    assert.deepEqual(
      [created.json().created.id, created.json().created.store_url, created.json().upload_link],
      [brand.id, "https://frostbuddy.com", `${ORIGIN}/upload/${brand.upload_token}`],
    );
    assert.match(created.json().copy_rule, /never names a team/);

    const duplicate = await call(client, "create_brand", { name: "frost buddy" });
    assert.ok(duplicate.isError);
    assert.match(duplicate.text, /A brand named Frost Buddy already exists .* allow_duplicate: true/);
    assert.equal(db.tables.brands.length, 1);

    const invited = await call(client, "invite_member", { brand: "Frost Buddy", email: "Jane@FrostBuddy.com" });
    assert.ok(!invited.isError, invited.text);
    assert.deepEqual([invited.json().email, invited.json().added], ["jane@frostbuddy.com", true]);
    assert.match(invited.json().welcome_email, /server log/);
    const emails = log.mock.calls.map((c) => String(c.arguments[0])).filter((s) => s.includes("welcome email for"));
    assert.equal(emails.length, 1);
    assert.match(emails[0], /welcome email for jane@frostbuddy\.com/);
    assert.match(emails[0], /op@walkoff\.io invited you to use Walkoff for Frost Buddy/);
    assert.ok(emails[0].includes(`${ORIGIN}/upload/${brand.upload_token}`));
    assert.ok(emails[0].includes(`${ORIGIN}/mcp`));
    assert.ok(emails[0].includes('Ask Claude: "Set up Walkoff for Frost Buddy from our Shopify store."'));
    assert.ok(emails[0].indexOf("Set up Walkoff for Frost Buddy") < emails[0].indexOf(`${ORIGIN}/upload/`), "the upload link is the fallback");

    const quiet = await call(client, "invite_member", { brand: "frost buddy", email: "jane@frostbuddy.com", send_email: false });
    assert.deepEqual([quiet.json().added, quiet.json().welcome_email], [false, "Not sent."]);
    assert.equal(log.mock.calls.filter((c) => String(c.arguments[0]).includes("welcome email for")).length, 1);

    const members = await call(client, "list_members", { brand: brand.id });
    assert.deepEqual(members.json().members.map((m: { email: string; connected: boolean }) => [m.email, m.connected]), [["jane@frostbuddy.com", false]]);

    const status = await call(client, "onboarding_status", { brand: "Frost Buddy" });
    assert.match(status.json().next, /^Waiting on jane@frostbuddy\.com to connect Walkoff in Claude/);
    const all = await call(client, "onboarding_status");
    assert.deepEqual(all.json().brands.map((s: { brand: string }) => s.brand), ["Frost Buddy"]);

    const updated = await call(client, "update_brand", { brand: "Frost Buddy", licensed: true });
    assert.equal(updated.json().updated.licensed, true);
    assert.match(updated.json().copy_rule, /may name the brand's teams/);
    assert.ok((await call(client, "update_brand", { brand: "Frost Buddy" })).isError);

    const removed = await call(client, "remove_member", { brand: "Frost Buddy", email: "JANE@frostbuddy.com" });
    assert.equal(removed.json().removed, "jane@frostbuddy.com");
    const again = await call(client, "remove_member", { brand: "Frost Buddy", email: "jane@frostbuddy.com" });
    assert.ok(again.isError);
    assert.match(again.text, /jane@frostbuddy\.com isn't a member of Frost Buddy\. It has no members\./);
    await client.close();
  });

  it("make changes only to the brand named exactly, never one whose name contains it", async (t) => {
    t.mock.method(console, "log", () => {});
    const db = fakeDb();
    const client = await connect(createWalkoffServer(ctxFor(operator, db)));
    await call(client, "create_brand", { name: "Sunday Supply", store_url: "sundaysupply.com" });
    // create_brand "Sun" failed, so "Sun" must not fall through to Sunday Supply.
    assert.ok((await call(client, "create_brand", { name: "Sun", store_url: "http://sun.co" })).isError);
    for (const [name, args] of [
      ["invite_member", { brand: "Sun", email: "bob@sun.co" }],
      ["update_brand", { brand: "Sun", licensed: true }],
      ["remove_member", { brand: "Sun", email: "bob@sun.co" }],
    ] as const) {
      const r = await call(client, name, args);
      assert.ok(r.isError, name);
      assert.equal(r.text, 'No brand is named "Sun". Use a brand\'s exact name or id. Names like it: Sunday Supply.', name);
    }
    assert.deepEqual([db.tables.brand_members ?? [], db.tables.brands[0].licensed], [[], false]);
    assert.ok(!(await call(client, "list_members", { brand: "sunday" })).isError, "reading can still use part of a name");
    assert.ok(!(await call(client, "invite_member", { brand: "sunday supply", email: "bob@sun.co", send_email: false })).isError);
    await client.close();
  });

  it("replace the upload link when asked, and say removal doesn't", async () => {
    const db = fakeDb();
    const client = await connect(createWalkoffServer(ctxFor(operator, db)));
    const before = (await call(client, "create_brand", { name: "Frost Buddy" })).json().upload_link;
    await call(client, "invite_member", { brand: "Frost Buddy", email: "jane@frostbuddy.com", send_email: false });
    const removed = (await call(client, "remove_member", { brand: "Frost Buddy", email: "jane@frostbuddy.com" })).json();
    assert.match(removed.note, /If they have the brand's upload link, it keeps working until you replace it: update_brand with new_upload_link/);
    const rotated = (await call(client, "update_brand", { brand: "Frost Buddy", new_upload_link: true })).json();
    assert.notEqual(rotated.upload_link, before);
    assert.equal(rotated.upload_link, `${ORIGIN}/upload/${db.tables.brands[0].upload_token}`);
    assert.match(rotated.note, /The old upload link no longer works/);
    assert.equal((await call(client, "update_brand", { brand: "Frost Buddy", licensed: true })).json().upload_link, undefined);
    await client.close();
  });

  it("asks for the id when two brands share a name", async () => {
    const db = fakeDb();
    const client = await connect(createWalkoffServer(ctxFor(operator, db)));
    await call(client, "create_brand", { name: "Frost Buddy" });
    assert.ok(!(await call(client, "create_brand", { name: "Frost Buddy", allow_duplicate: true })).isError);
    const r = await call(client, "invite_member", { brand: "Frost Buddy", email: "jane@frostbuddy.com", send_email: false });
    assert.ok(r.isError);
    assert.match(r.text, /More than one brand is named Frost Buddy\. Use its id/);
    await client.close();
  });

  it("keeps the invite and says so when the welcome email fails", async (t) => {
    t.mock.method(console, "error", () => {});
    const env = process.env as Record<string, string | undefined>;
    const saved = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const db = fakeDb();
      const client = await connect(createWalkoffServer(ctxFor(operator, db)));
      await call(client, "create_brand", { name: "Frost Buddy" });
      const r = await call(client, "invite_member", { brand: "Frost Buddy", email: "jane@frostbuddy.com" });
      assert.ok(r.isError);
      assert.match(r.text, /jane@frostbuddy\.com can now use Walkoff for Frost Buddy, but the welcome email didn't send\./);
      assert.equal(db.tables.brand_members.length, 1);
      await client.close();
    } finally {
      if (saved === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = saved;
    }
  });
});
