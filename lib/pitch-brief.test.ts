// docs/pitch-brief.md is what other agents read to make decks, one-pagers
// and emails about Walkoff. Its prices, leagues, tours, moments, send hours
// and sample story come from the code, and these checks fail when the code
// moves on without it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { mapHighlights, sampleCampaign, sampleHometownCampaign } from "./help/samples";
import { LEAGUES } from "./leagues";
import { teamByKey } from "./mcp/teams";
import { SEND_HOURS } from "./mcp/timing";
import { territoryName } from "./outreach/pitch";
import { annualMonthlyPrice, monthlyPrice, PRICING } from "./pricing";
import { TOURS } from "./tours";
import { ALL_TRIGGERS } from "./triggers";

const BRIEF = readFileSync(new URL("../docs/pitch-brief.md", import.meta.url), "utf8");
// Lines wrap anywhere, so phrases are looked for with the wrapping undone.
const TEXT = BRIEF.replace(/\s+/g, " ");

function says(text: string) {
  assert.ok(TEXT.includes(text), `docs/pitch-brief.md should say "${text}"`);
}

// 21 -> "9 PM", 8 -> "8 AM"
const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

describe("pitch brief", () => {
  it("has today's prices", () => {
    for (let leagues = 1; leagues <= LEAGUES.length; leagues++) {
      says(`$${monthlyPrice(leagues)}`);
      says(`$${annualMonthlyPrice(leagues)}`);
    }
    says(`${PRICING.annualDiscount * 100}% off`);
    says(`${PRICING.trialDays} days free`);
  });

  it("names every league and tour", () => {
    for (const l of LEAGUES) {
      says(l.name);
      if (l.note) says(l.note);
    }
    for (const t of TOURS) says(t.name);
  });

  it("lists every moment, live or coming", () => {
    const rows = BRIEF.split("\n");
    for (const t of ALL_TRIGGERS) {
      const row = rows.find((r) => r.startsWith(`| ${t.name} |`));
      assert.ok(row, `docs/pitch-brief.md has no row for ${t.name}`);
      assert.ok(row.endsWith(t.coming ? "| Coming |" : "| Live |"), `${t.name} is ${t.coming ? "coming" : "live"} now`);
    }
  });

  it("has today's send hours", () => {
    says(`after ${hour(SEND_HOURS.latest)} waits for ${hour(SEND_HOURS.earliest)}`);
  });

  it("tells the site's sample story", async () => {
    const c = sampleCampaign();
    says(c.subject_lines[0]);
    for (const p of c.products) says(`${p.title} in ${p.colorway}`);
    for (const circle of c.audience.circles) says(`within ${circle.radius_miles} miles of ${circle.postal_code}`);
    for (const g of mapHighlights(2, 2)) {
      const team = teamByKey(`${g.league}:${g.teamId}`)!;
      says(`${territoryName(team)} ${g.lift}× (${Math.round(g.customers).toLocaleString("en-US")} customers)`);
    }
    const town = await sampleHometownCampaign();
    says(town.subject_lines[0]);
    for (const circle of town.audience.circles) says(`within ${circle.radius_miles} miles of ${circle.postal_code}`);
  });

  it("keeps the site's voice: no em or en dashes", () => {
    assert.ok(!/[–—]/.test(BRIEF), "docs/pitch-brief.md has a dash: use a colon, a comma or a period");
  });
});
