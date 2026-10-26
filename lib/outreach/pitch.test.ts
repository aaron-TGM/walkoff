import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Pick } from "../affinity/pick";
import type { CampaignMoment } from "../mcp/campaign";
import { teamByKey } from "../mcp/teams";
import { buildPitch, momentFromRow, pageHtml, possessive, sampleMoment, whenPhrase, type PitchInput } from "./pitch";

const CHARGERS = teamByKey("nfl:24")!;
const LA = "America/Los_Angeles";

const pick = (title: string, colorway: string, hex: string): Pick => ({
  handle: title.toLowerCase().replace(/ /g, "-"),
  title,
  colorway,
  hex: [hex],
  skus: [],
  image: `https://cdn.example.com/${colorway}.jpg`,
  why: "Close to their blue",
  score: 0.9,
  price: 58,
});

const PICKS = [pick("Everyday Jogger", "Azure Heather", "2e8bd8"), pick("Sunday Hoodie", "Sunflower", "ffc512"), pick("Coastal Crew", "Gold", "ffb81c")];

/** Monday 8:30 AM in Los Angeles. */
const NOW = new Date("2026-10-26T15:30:00Z");

/** The Chargers won Sunday at 8:40 PM in Los Angeles. */
const WIN: CampaignMoment = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "team_win",
  phase: "after",
  headline: "Chargers beat Raiders 27-20",
  intensity: 0.6,
  occurredAt: new Date("2026-10-26T03:40:00Z"),
  gameStart: null,
  team: CHARGERS,
};

const input = (o: Partial<PitchInput> = {}): PitchInput => ({
  prospect: { name: "Frost Buddy", domain: "frostbuddy.com", store_url: "https://frostbuddy.com" },
  team: CHARGERS,
  picks: PICKS,
  moment: WIN,
  contact: { first_name: "Sam" },
  link: "https://www.walkoff.io/p/abc123",
  sender: { name: "Aaron, founder of Walkoff", address: "100 Example St, San Diego, CA 92101" },
  now: NOW,
  ...o,
});

describe("buildPitch", () => {
  it("writes a short email that names the win and links the page", () => {
    const { email, warnings } = buildPitch(input());
    assert.equal(email.subject, "The Chargers won. Here's your email.");
    assert.match(email.body, /^Hi Sam,\n/);
    assert.match(email.body, /The Chargers won last night\./);
    assert.match(email.body, /about a minute after the final whistle/);
    assert.match(email.body, /Here's Frost Buddy's, for customers in Chargers territory:\n\nhttps:\/\/www\.walkoff\.io\/p\/abc123\n/);
    assert.match(email.body, /nothing sends without your OK/);
    assert.match(email.body, /free for 60 days/);
    assert.match(email.body, /100 Example St, San Diego, CA 92101\nNot for you\? Reply "no thanks"/);
    assert.deepEqual(warnings, []);
  });

  it("shows the campaign as it would have gone out that night", () => {
    const { page } = buildPitch(input());
    assert.equal(page.subject, "Azure and sunflower kind of Sunday.");
    assert.equal(page.send.send_at_local, "Sun 8:42 PM PDT");
    assert.equal(page.moment.occurred_at, WIN.occurredAt.toISOString());
    assert.deepEqual(page.products.map((p) => p.url), [
      "https://frostbuddy.com/products/everyday-jogger",
      "https://frostbuddy.com/products/sunday-hoodie",
      "https://frostbuddy.com/products/coastal-crew",
    ]);
    assert.equal(page.team.tz, LA);
  });

  it("keeps the team out of the customer's email, as for any brand without a license", () => {
    const { page, email } = buildPitch(input());
    for (const name of ["Chargers", "LAC", "NFL", "Raiders"]) assert.ok(!page.html.includes(name), `the email says ${name}`);
    assert.ok(page.copy_rules.some((r) => r.startsWith("Never name the team")));
    assert.match(email.body, /Chargers/, "the note to the marketer may name it");
  });

  it("fills in Klaviyo's tags for the page", () => {
    const { page } = buildPitch(input());
    assert.ok(!/\{\{|\{%/.test(page.html));
    assert.ok(page.html.includes('<base target="_blank">'));
    assert.ok(page.html.includes('<meta name="referrer" content="no-referrer">'));
    assert.ok(page.html.includes("Frost Buddy<br>"));
  });

  it("pitches the next win when there's been none lately", () => {
    const { email, page, warnings } = buildPitch(input({ moment: sampleMoment(CHARGERS, NOW), contact: null, sender: { name: null, address: null } }));
    assert.equal(email.subject, "Your Chargers email");
    assert.match(email.body, /^Hi there,\n\nWhen the Chargers win, Walkoff picks it up/);
    assert.match(email.body, /\[your name\][\s\S]*\[your postal address\]/);
    assert.deepEqual([page.moment.id, page.moment.occurred_at], [null, null]);
    assert.ok(!warnings.some((w) => w.startsWith("This is a sample")));
    assert.ok(warnings.some((w) => w.includes("OUTREACH_ADDRESS")));
  });

  it("says schools and clubs the way fans do", () => {
    const ucla = teamByKey("ncaaf:26")!;
    const spurs = teamByKey("epl:367")!;
    assert.match(buildPitch(input({ team: ucla, moment: sampleMoment(ucla, NOW) })).email.body, /When UCLA wins,/);
    assert.match(buildPitch(input({ team: spurs, moment: sampleMoment(spurs, NOW) })).email.body, /When Tottenham Hotspur win,/);
  });

  it("warns when the result is getting old", () => {
    const old = { ...WIN, occurredAt: new Date(NOW.getTime() - 4 * 86_400_000) };
    assert.ok(buildPitch(input({ moment: old })).warnings.some((w) => w.includes("three days old")));
  });
});

describe("whenPhrase", () => {
  it("says when, where the team plays", () => {
    assert.equal(whenPhrase(new Date("2026-10-26T03:40:00Z"), NOW, LA), "last night");
    assert.equal(whenPhrase(new Date("2026-10-25T20:00:00Z"), NOW, LA), "yesterday");
    assert.equal(whenPhrase(new Date("2026-10-26T15:00:00Z"), NOW, LA), "today");
    assert.equal(whenPhrase(new Date("2026-10-23T22:00:00Z"), NOW, LA), "on Friday");
  });
});

describe("possessive", () => {
  it("adds an apostrophe, and an s unless the name ends in one", () => {
    assert.deepEqual(["Frost Buddy", "Outdoor Voices"].map(possessive), ["Frost Buddy's", "Outdoor Voices'"]);
  });
});

describe("pageHtml", () => {
  it("escapes the brand's name", () => {
    assert.ok(pageHtml("<head></head>{{ organization.name }}", "Bob & Sons <b>").includes("Bob &amp; Sons &lt;b&gt;"));
  });
});

describe("momentFromRow", () => {
  it("reads a moment from the database, or nothing for a team Walkoff doesn't map", () => {
    const row = {
      id: WIN.id!, type: "team_win", phase: "after", league: "nfl", game_id: null, team_id: "espn:nfl:24", opponent_team_id: null,
      headline: WIN.headline, intensity: 0.6, detail: {}, occurred_at: WIN.occurredAt.toISOString(), detected_at: WIN.occurredAt.toISOString(),
    };
    assert.equal(momentFromRow(row)?.team.key, "nfl:24");
    assert.equal(momentFromRow({ ...row, team_id: "espn:nfl:9999" }), null);
  });
});
