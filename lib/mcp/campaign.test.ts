import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hexForColorName } from "../affinity/colors";
import { pickForTeam, type PickProduct } from "../affinity/pick";
import { assertNeverNames } from "../testing/names";
import { teamAudience } from "./audience";
import { buildCampaign, colorWords, type CampaignMoment } from "./campaign";
import { teamByKey, type TeamRef } from "./teams";

const cw = (name: string, image = "") => ({ name, hex: hexForColorName(name), skus: [`SKU-${name}`], image });
const catalog: PickProduct[] = [
  { handle: "everyday-jogger", title: "Everyday Jogger", teams: [], price: 98, colorways: [cw("Azure Heather", "https://cdn.example.com/jogger.jpg"), cw("Black")] },
  { handle: "sunday-hoodie", title: "Sunday Hoodie", teams: [], price: 118, colorways: [cw("Sunflower"), cw("Heather Grey")] },
  { handle: "ponto-short", title: "Ponto Short", teams: [], price: 64.5, colorways: [cw("Navy"), cw("Royal Blue")] },
];

const CHARGERS = teamByKey("nfl:24")!;
const MICHIGAN = teamByKey("ncaaf:130")!;
const SPURS = teamByKey("epl:367")!;
const END = new Date("2026-10-18T23:41:00Z"); // Sunday 4:41 PM in LA

function campaign(
  team: TeamRef,
  type: string,
  opts: { licensed?: boolean; store?: string | null; id?: string | null; offer?: string; phase?: string; reach?: "core" | "wide" } = {},
) {
  const moment: CampaignMoment = {
    id: opts.id === undefined ? "8c1f2d3e-0000-4000-8000-000000000001" : opts.id,
    type,
    phase: opts.phase ?? "after",
    headline: "Walk-off win: Chargers 27, Raiders 24",
    intensity: 0.95,
    occurredAt: END,
    gameStart: null,
    team,
  };
  return buildCampaign({
    brand: { name: "Sample Athletic", storeUrl: opts.store === undefined ? "https://sample.co/" : opts.store, licensed: opts.licensed ?? false },
    moment,
    picks: pickForTeam(catalog, team.league, team.team, 3),
    audience: teamAudience(team, { reach: opts.reach }),
    options: { now: new Date(END.getTime() + 5 * 60_000), offer: opts.offer },
  });
}

/** Everything a shopper sees. */
const seen = (c: ReturnType<typeof campaign>) => [...c.subject_lines, c.preview_text, c.headline, c.body, c.html].join("\n");

describe("buildCampaign", () => {
  it("nods to the city and the colors, never the team, for brands without a license", () => {
    const c = campaign(CHARGERS, "walkoff_win", { reach: "wide" });
    assert.deepEqual(c.subject_lines, ["Azure and sunflower kind of Sunday.", "LA, that finish.", "Right down to the last second."]);
    assert.equal(c.body, "Some wins you feel all week. We picked a few things in the colors LA is wearing today.");
    assertNeverNames(seen(c), CHARGERS);
    assert.match(c.copy_rules[0], /Never name the team/);
  });

  it("names the city only when the audience lives there", () => {
    // The Chargers' core audience is San Diego, not LA.
    const c = campaign(CHARGERS, "walkoff_win");
    assert.equal(c.audience.includes_home, false);
    assert.equal(c.subject_lines[1], "That finish.");
    assert.ok(!seen(c).includes("LA"));
    const kc = campaign(teamByKey("nfl:12")!, "walkoff_win");
    assert.equal(kc.subject_lines[1], "Kansas City, that finish.");
  });

  it("college teams and clubs get colors only, not even the place", () => {
    for (const [team, type] of [[MICHIGAN, "comeback_win"], [SPURS, "late_winner"]] as const) {
      const c = campaign(team, type);
      assertNeverNames(seen(c), team);
      assert.ok(!seen(c).includes(team.team.location), `names ${team.team.location}`);
    }
  });

  it("an ordinary win gets its own copy", () => {
    const c = campaign(CHARGERS, "team_win", { reach: "wide" });
    assert.equal(c.headline, "That's a win.");
    assert.deepEqual(c.subject_lines, ["Azure and sunflower kind of Sunday.", "LA, enjoy this one.", "Wins look good in blue."]);
    assertNeverNames(seen(c), CHARGERS);
  });

  it("licensed brands may name the team", () => {
    const c = campaign(CHARGERS, "comeback_win", { licensed: true });
    assert.equal(c.subject_lines[0], "Chargers win. Azure and sunflower kind of Sunday.");
    assert.equal(c.subject_lines[2], "Chargers fans don't quit.");
  });

  it("a loss is consoled, not celebrated", () => {
    const c = campaign(CHARGERS, "heartbreak_loss", { offer: "15% off with code CHINUP" });
    assert.equal(c.headline, "Still blue.");
    assert.ok(c.warnings.some((w) => /keep it gentle/.test(w)));
    assert.match(c.html, /15% off with code CHINUP/);
  });

  it("builds a Klaviyo-ready email with products, links and prices", () => {
    const c = campaign(CHARGERS, "walkoff_win");
    assert.match(c.html, /\{% unsubscribe %\}/);
    assert.match(c.html, /\{\{ organization\.full_address \}\}/);
    assert.match(c.html, /href="https:\/\/sample\.co\/products\/everyday-jogger"/);
    assert.match(c.html, /src="https:\/\/cdn\.example\.com\/jogger\.jpg"/);
    assert.deepEqual(c.products.map((p) => p.price), ["$98", "$118"]);
    assert.equal(c.cta.url, "https://sample.co");
    assert.equal(c.send.send_at_local, "Sun 4:46 PM PDT");
    assert.equal(c.campaign_name, "Walkoff · Los Angeles Chargers · Walk-Off Win · Oct 18");
    assert.match(c.klaviyo_steps.join("\n"), /log_send with moment_id 8c1f2d3e/);
    assert.deepEqual(c.warnings, []);
  });

  it("has Claude offer to create a missing segment, with the marketer's OK", () => {
    const [audience] = campaign(CHARGERS, "walkoff_win").klaviyo_steps;
    assert.match(audience, /look for a segment named "Walkoff · Los Angeles Chargers fans" \(get_segments\)/);
    assert.match(audience, /ask the marketer whether to create it/);
    assert.match(audience, /With their OK, create it from audience\.klaviyo_segment, which has its name and definition \(create_segment\)/);
    assert.match(audience, /audience\.klaviyo_segment_steps/);
  });

  it("drafts with the brand's own UTM tracking, and reads results from Klaviyo", () => {
    const steps = campaign(CHARGERS, "walkoff_win").klaviyo_steps;
    const draft = steps.find((s) => s.startsWith("Draft:")) ?? "";
    assert.match(draft, /Turn its UTM tracking on, with the account's own parameters/);
    assert.match(steps.at(-1) ?? "", /^Results: .* \(get_campaign_report\): recipients, clicks, orders and revenue\.$/);
  });

  it("escapes product text, including Klaviyo's braces", () => {
    const team = CHARGERS;
    const c = buildCampaign({
      brand: { name: "A&B <Co>", storeUrl: "https://ab.co", licensed: false },
      moment: { id: null, type: "walkoff_win", phase: "after", headline: "", intensity: 1, occurredAt: END, gameStart: null, team },
      picks: [{ handle: "x", title: 'Tee {{ hack }} "quoted"', colorway: null, hex: ["0080c6"], skus: [], image: "javascript:alert(1)", why: "Close to their blue", score: 1 }],
      audience: teamAudience(team),
      options: { now: END },
    });
    assert.ok(!c.html.includes("{{ hack }}"));
    assert.ok(c.html.includes("A&amp;B &lt;Co&gt;"));
    assert.ok(!c.html.includes("javascript:"), "only http(s) images");
    assert.ok(c.warnings.some((w) => /sample/.test(w)));
    assert.ok(!c.klaviyo_steps.some((s) => s.includes("log_send")), "samples aren't logged");
  });

  it("warns when there's no store, and when the moment is live", () => {
    const c = campaign(CHARGERS, "close_game", { store: null, phase: "during" });
    assert.ok(c.warnings.some((w) => /still live/.test(w)));
    assert.ok(c.warnings.some((w) => /No store address/.test(w)));
    assert.equal(c.products[0].url, null);
  });
});

describe("colorWords", () => {
  it("follows the team's color order, in the brand's words where it can", () => {
    const lakers = ["552583", "fdb927"];
    const picks = pickForTeam(catalog, "nba", { id: "13", colors: lakers });
    assert.equal(colorWords(picks, lakers).phrase, "purple and sunflower");
    assert.equal(colorWords([], ["0080c6", "ffc20e"]).phrase, "blue and gold");
  });
});
