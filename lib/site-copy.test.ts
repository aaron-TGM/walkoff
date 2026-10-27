import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Claims the product doesn't back. Walkoff drafts and the marketer sends,
// moments arrive on their own, and the MCP server is www.walkoff.io/mcp.
const UNTRUE = [
  "auto-fire",
  "or you go first",
  "fires your message",
  "fired to",
  "confirmed by hand",
  "sent by hand",
  "quiet hours",
  "frequency cap",
  "instant pause",
  "30-minute window",
  "configurable per brand",
  "upcoming_moments",
  "mcp.walkoff.io",
  // Walkoff adds no tracking of its own: the brand's Klaviyo UTMs and
  // attribution do it.
  "tracked to the order",
  "matched to your store's orders",
  "gets matched to your orders",
  // Walkoff holds no Klaviyo or Shopify keys: Claude's connectors do the work.
  "encrypt keys",
  // The marketer reviews and approves every send.
  "triggers and approvals",
  "done for you, start to finish",
  // Brands on Shopify set up in Claude, with no files, and their postal
  // codes reach Walkoff (cut to areas on arrival). Only the upload page, for
  // files, can say they stay on the computer.
  "drop in your exports",
  "never leave your computer",
  // Walkoff is documented for Claude and Claude Code, no other agent.
  "any ai agent",
  "every ai agent",
  "every agent",
  "v1 coverage",
  // Walkoff knows where customers live, not who they root for.
  "customers who care",
  "cheer for",
  "actually follow",
  "widely recognized fan territor",
  // No performance claims without data behind them.
  "converts well",
  "conversion lever",
  // Sample details that were shown next to Vuori's real email.
  "ready 2 minutes later",
  "powder blue kind of sunday",
];

// Legal text changes when the founder says so. The terms still cover
// auto-fire rules. The upload page reads files in the browser.
const ALLOWED: Record<string, string[]> = {
  "app/terms/page.tsx": ["auto-fire"],
  "components/upload/UploadClient.tsx": ["never leave your computer"],
};

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return path === "lib/testing" ? [] : sources(path);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("site copy", () => {
  it("only claims what Walkoff does today", () => {
    const files = ["app", "components", "lib"].flatMap(sources);
    assert.ok(files.includes("components/MarketingPage.tsx"));
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), "utf8").toLowerCase();
      for (const claim of UNTRUE) {
        if (!ALLOWED[file]?.includes(claim)) assert.ok(!text.includes(claim), `${file} says "${claim}"`);
      }
    }
  });
});
