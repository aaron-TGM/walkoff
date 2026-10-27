// The examples on the help pages, made by the same code the tools run. The
// pages are static, so this runs at build time and none of it (or the geo
// data behind it) is sent to the browser.
import { computeAffinity } from "../affinity/compute";
import { DEMO_BRAND, demoData } from "../affinity/demo";
import { pickForTeam } from "../affinity/pick";
import { hometownRules } from "../hometown/copy";
import { teamAudience, type Reach } from "../mcp/audience";
import { buildCampaign, copyRules } from "../mcp/campaign";
import { buildHometownCampaign, townAudience, townPicks, type HometownCampaign } from "../mcp/hometown-campaign";
import { teamByKey } from "../mcp/teams";
import { formatLocal, sendTiming } from "../mcp/timing";
import { placeLabel, resolveTown, townCircle } from "../places";

/** A store address that can't be anyone's (RFC 2606). */
export const SAMPLE_STORE = "https://shop.example.com";
export const SAMPLE_BRAND = { name: DEMO_BRAND, storeUrl: SAMPLE_STORE, licensed: false };

/** The demo brand's Chargers fans live around San Diego. */
export const SAMPLE_TEAM = teamByKey("nfl:24")!;
export const SAMPLE_COLLEGE = teamByKey("ncaaf:30")!;
export const SAMPLE_CLUB = teamByKey("epl:367")!;

/** Sunday 4:41 PM in Los Angeles. */
const END = new Date("2026-10-18T23:41:00Z");
const MINUTE = 60_000;

let seed: ReturnType<typeof demoData> | undefined;
const demo = () => (seed ??= demoData());

/** The demo brand's map, as walkoff.io/upload/demo shows it. */
export const demoReport = () => {
  const s = demo();
  return computeAffinity(s.areas, { products: s.products, catalog: s.catalog, now: END });
};

export const sampleAudience = (reach: Reach = "core") =>
  teamAudience(SAMPLE_TEAM, { reach, customersByArea: new Map(demo().areas.map((a) => [`${a.country}:${a.area}`, a.customers])) });

export const clubAudience = () => teamAudience(SAMPLE_CLUB);

/** What build_campaign returns when asked for a sample Chargers walk-off. */
export function sampleCampaign() {
  return buildCampaign({
    brand: SAMPLE_BRAND,
    moment: {
      id: null,
      type: "walkoff_win",
      phase: "after",
      headline: "Sample: Walk-Off Win",
      intensity: 0.9,
      occurredAt: END,
      gameStart: null,
      team: SAMPLE_TEAM,
    },
    picks: pickForTeam(demo().catalog, SAMPLE_TEAM.league, SAMPLE_TEAM.team, 3),
    audience: sampleAudience(),
    options: { now: new Date(END.getTime() + 5 * MINUTE) },
  });
}

/** A hometown title for the demo brand: someone from San Clemente is on the
 *  champion's roster, and the champion wears navy and green. */
export const SAMPLE_TOWN = "San Clemente, CA";
export const SAMPLE_CHAMPION = teamByKey("nfl:26")!;

/** 7:30 PM in San Clemente. */
const TITLE_NIGHT = new Date("2026-02-09T03:30:00Z");

let hometown: Promise<HometownCampaign> | undefined;

/** What build_campaign returns for a sample hometown title in San Clemente.
 *  Async: the town's circle comes from the places data. */
export const sampleHometownCampaign = () =>
  (hometown ??= (async () => {
    const found = await resolveTown(SAMPLE_TOWN);
    if (found.status !== "found") throw new Error(`${SAMPLE_TOWN}: ${found.status}`);
    const { place } = found;
    const label = placeLabel(place);
    return buildHometownCampaign({
      brand: SAMPLE_BRAND,
      moment: {
        id: null,
        type: "hometown_title",
        headline: "Sample: Hometown Champion",
        occurredAt: TITLE_NIGHT,
        gameStart: null,
        town: { label, name: place.name, country: place.country, region: place.region },
        team: SAMPLE_CHAMPION,
      },
      picks: townPicks(demo().catalog, place.name, { team: SAMPLE_CHAMPION, sport: null }),
      audience: townAudience(label, await townCircle(place)),
      options: { now: new Date(TITLE_NIGHT.getTime() + 5 * MINUTE) },
    });
  })());

/** The sample email as a page: Klaviyo's tags become sample text, and links
 *  open nowhere (the frame that shows it allows no new windows). */
export function sampleEmailHtml(): string {
  return sampleCampaign()
    .html.replace("<head>", '<head>\n<base target="_blank">')
    .replace("{{ organization.name }}", DEMO_BRAND)
    .replace("{{ organization.full_address }}", "100 Example Way, San Diego, CA 92101")
    .replace("{% unsubscribe %}", '<a href="#" style="color:#8a8a8a;">Unsubscribe</a>');
}

/** The copy rules for the three kinds of brand and team, and for a
 *  hometown campaign. */
export const sampleCopyRules = () => ({
  pro: copyRules(SAMPLE_BRAND, SAMPLE_TEAM),
  college: copyRules(SAMPLE_BRAND, SAMPLE_COLLEGE),
  licensed: copyRules({ ...SAMPLE_BRAND, licensed: true }, SAMPLE_TEAM),
  hometown: hometownRules({ brand: SAMPLE_BRAND.name, licensed: false, mayName: null }),
});

const LA = "America/Los_Angeles";
const NY = "America/New_York";

/** When Walkoff would send, for a few real situations, in the fans' time. */
export function timingExamples(): { happened: string; asked: string; send: string; why: string }[] {
  const lateNy = new Date("2026-10-19T03:35:00Z");
  const kickoff = new Date("2026-10-20T02:30:00Z");
  const saturday = new Date("2026-10-17T20:00:00Z");
  const gameDay = new Date("2026-10-19T18:00:00Z");
  const asked = new Date(END.getTime() + 5 * MINUTE);
  const cases = [
    { happened: `A win ends ${formatLocal(END, LA)}`, now: asked, t: sendTiming({ phase: "after", occurredAt: END, tz: LA, now: asked }), tz: LA },
    { happened: `A win ends ${formatLocal(lateNy, NY)}`, now: lateNy, t: sendTiming({ phase: "after", occurredAt: lateNy, tz: NY, now: lateNy }), tz: NY },
    {
      happened: `A rivalry game kicks off ${formatLocal(kickoff, LA)}`,
      now: saturday,
      t: sendTiming({ phase: "before", occurredAt: saturday, gameStart: kickoff, tz: LA, now: saturday }),
      tz: LA,
    },
    {
      happened: "The same game",
      now: gameDay,
      t: sendTiming({ phase: "before", occurredAt: gameDay, gameStart: kickoff, tz: LA, now: gameDay }),
      tz: LA,
    },
  ];
  return cases.map((c) => ({ happened: c.happened, asked: formatLocal(c.now, c.tz), send: c.t.send_at_local, why: c.t.why }));
}
