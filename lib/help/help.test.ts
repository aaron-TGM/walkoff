// Keeps the help center true to the product: its pages, tools, quotes,
// numbers and examples come from the code, and these checks fail when the
// code moves on without it.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { parseCustomerUpload } from "../affinity/validate";
import { KLAVIYO_TOOLS } from "../mcp/campaign";
import { createWalkoffServer } from "../mcp/server";
import { noDb } from "../testing/fake-db";
import { assertNeverNames } from "../testing/names";
import { KLAVIYO_FLOW } from "./klaviyo";
import { FINISHES } from "./moments";
import { HELP_PAGES, helpMetadata, helpUrl } from "./pages";
import { sampleCampaign, sampleCopyRules, sampleEmailHtml, SAMPLE_TEAM, timingExamples } from "./samples";
import { SESSIONS } from "./sessions";
import { HELP_TOOLS, HOME_TOOLS, type HelpTool } from "./tools";
import { TROUBLE } from "./troubleshooting";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return files(path);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Everything the help center is written in. */
const HELP_SOURCES = ["app/(guide)", "components/help", "lib/help"].flatMap(files);
const pageFile = (path: string) => `app/(guide)${path}/page.tsx`;

const OPERATOR_TOOLS = ["create_brand", "update_brand", "invite_member", "list_members", "remove_member", "onboarding_status"];

async function memberClient() {
  const server = createWalkoffServer({
    db: noDb,
    principal: { email: "jane@frostbuddy.com", brandIds: ["7d1c2f9e-1111-4c8a-9a51-0d6c3b0e8f10"], clientId: "claude", scope: "walkoff" },
    now: () => new Date("2026-10-23T12:00:00Z"),
    origin: "https://www.walkoff.io",
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "help-test", version: "1.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

describe("help pages", () => {
  it("each has a page, and every page is in the list", () => {
    for (const p of HELP_PAGES) assert.ok(existsSync(join(ROOT, pageFile(p.path))), `${p.slug} has no ${pageFile(p.path)}`);
    const listed = new Set(HELP_PAGES.map((p) => pageFile(p.path)));
    for (const f of files("app/(guide)").filter((f) => f.endsWith("/page.tsx"))) assert.ok(listed.has(f), `${f} isn't in HELP_PAGES`);
    assert.equal(new Set(HELP_PAGES.map((p) => p.slug)).size, HELP_PAGES.length, "slugs are unique");
  });

  it("each page has its metadata and every section it lists", () => {
    for (const p of HELP_PAGES) {
      const src = read(pageFile(p.path));
      assert.ok(src.includes(`helpMetadata("${p.slug}")`), `${p.slug} uses another page's metadata`);
      assert.ok(src.includes(`const P = "${p.slug}";`), `${p.slug} renders another page's sections`);
      for (const s of p.sections) assert.ok(src.includes(`id="${s.id}"`), `${p.path} has no section ${s.id}`);
      const ids = p.sections.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, `${p.slug} repeats a section`);
      assert.equal(helpMetadata(p.slug).alternates?.canonical, p.path);
    }
  });

  it("links are absolute where they leave the site", () => {
    assert.equal(helpUrl("https://www.walkoff.io/", "connect", "sign-in"), "https://www.walkoff.io/help/connect#sign-in");
    assert.equal(helpUrl("http://localhost:3000", "onboarding"), "http://localhost:3000/onboarding");
  });
});

describe("tool reference", () => {
  it("covers exactly the tools a brand's members get", async () => {
    const client = await memberClient();
    const tools = (await client.listTools()).tools;
    assert.deepEqual(Object.keys(HELP_TOOLS).sort(), tools.map((t) => t.name).sort());
    for (const t of tools) {
      const help: HelpTool = HELP_TOOLS[t.name as keyof typeof HELP_TOOLS];
      assert.equal(!!help.changes, t.annotations?.readOnlyHint !== true, `${t.name}: read-only or not`);
      assert.ok(help.asks.length, `${t.name} has nothing to ask`);
      const props = (t.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
      for (const [opt, text] of Object.entries(help.options ?? {})) {
        assert.ok(opt in props, `${t.name} has no option ${opt}`);
        const def = text.match(/Default \d+\./)?.[0];
        if (def) assert.ok(props[opt].description?.includes(def), `${t.name}.${opt}: the tool doesn't say "${def}"`);
      }
    }
    const prompts = (await client.listPrompts()).prompts;
    assert.ok(prompts.some((p) => p.name === "moment_campaign" && p.title === "Campaign for the moment"));
    assert.ok(client.getInstructions()?.includes("https://www.walkoff.io/help"), "Claude knows where the help is");
    await client.close();
  });

  it("the homepage lists only real tools, or marks them coming", () => {
    for (const t of HOME_TOOLS) assert.ok(t.name in HELP_TOOLS || "soon" in t, t.name);
  });

  it("examples only call tools members have", () => {
    for (const s of Object.values(SESSIONS)) {
      for (const l of s.lines) if (l.kind === "tool") assert.ok(l.text in HELP_TOOLS, `${l.text} isn't a member tool`);
    }
  });

  it("public help never mentions the operator tools", () => {
    for (const file of HELP_SOURCES) {
      const src = read(file);
      for (const name of OPERATOR_TOOLS) assert.ok(!src.includes(name), `${file} mentions ${name}`);
    }
  });
});

describe("help facts", () => {
  it("quotes messages word for word from where people see them", () => {
    for (const t of Object.values(TROUBLE).flat()) {
      if (t.says.includes("…")) assert.ok(t.check && t.says.includes(t.check), `${t.id}: check must be part of says`);
      assert.ok(read(t.source).includes(t.check ?? t.says), `${t.source} no longer says "${t.check ?? t.says}"`);
    }
    const ids = Object.values(TROUBLE).flat().map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length, "each answer has its own anchor");
  });

  it("big finishes match the engine's rules", () => {
    const rules = read("engine/moments/rules.ts");
    for (const f of FINISHES) assert.ok(rules.includes(f.check), `the engine no longer has "${f.check}" (${f.moment}, ${f.sport})`);
  });

  it("the postal areas on the uploads page are ones the server accepts", () => {
    const src = read(pageFile("/help/uploads"));
    const areas = [
      { country: "US", area: "921" },
      { country: "CA", area: "M5V" },
      { country: "GB", area: "N17" },
    ];
    for (const a of areas) assert.ok(src.includes(`<td>${a.area}</td>`), `the page no longer shows ${a.area}`);
    const upload = parseCustomerUpload({ format: "counts_csv", rows: 3, skipped: 0, areas: areas.map((a) => ({ ...a, customers: 10 })) });
    assert.equal(upload.areas.length, 3);
    assert.throws(() => parseCustomerUpload({ format: "counts_csv", areas: [{ country: "US", area: "92101", customers: 1 }] }), /coarse/);
  });

  it("the Klaviyo guide names the tools Walkoff's drafting steps use", () => {
    const steps = sampleCampaign().klaviyo_steps.join("\n");
    const named = KLAVIYO_FLOW.flatMap((f) => f.tools).filter((t) => t !== "send_campaign");
    for (const tool of Object.values(KLAVIYO_TOOLS)) assert.ok(named.includes(tool), `the guide leaves out ${tool}`);
    for (const tool of named) assert.ok(steps.includes(`(${tool})`), `the drafting steps don't use ${tool}`);
    assert.ok(read(pageFile("/help/klaviyo")).includes("KLAVIYO_FLOW.map"), "the table comes from KLAVIYO_FLOW");
  });

  it("results come from Klaviyo's report, as the guide says", async () => {
    const client = await memberClient();
    const instructions = client.getInstructions() ?? "";
    assert.ok(instructions.includes(`(${KLAVIYO_TOOLS.report})`), "Claude is told where results are");
    assert.ok(instructions.includes(helpUrl("https://www.walkoff.io", "klaviyo", "tracking")), "and where the guide is");
    const history = (await client.listTools()).tools.find((t) => t.name === "send_history");
    assert.ok(history?.description?.includes(KLAVIYO_TOOLS.report), "send_history points to the report too");
    await client.close();
  });

  it("the sample campaign never names the team, and shows no Klaviyo tags", () => {
    const c = sampleCampaign();
    assertNeverNames([...c.subject_lines, c.preview_text, c.headline, c.body, c.html].join("\n"), SAMPLE_TEAM);
    assert.ok(c.products.length >= 2, "it features the demo brand's products");
    const page = sampleEmailHtml();
    assert.ok(!/\{\{|\{%/.test(page), "Klaviyo's tags are filled in for the page");
    assert.match(page, /<base target="_blank">/);
  });

  it("is written without em dashes", () => {
    const rendered = [
      ...Object.values(sampleCopyRules()).flat(),
      ...timingExamples().flatMap((t) => Object.values(t)),
      ...Object.values(TROUBLE).flat().flatMap((t) => [t.says, t.fix]),
    ];
    for (const file of HELP_SOURCES) assert.ok(!read(file).includes("—"), `${file} has an em dash`);
    for (const text of rendered) assert.ok(!text.includes("—"), `"${text}" has an em dash`);
  });
});
