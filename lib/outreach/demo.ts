// walkoff.io/p/demo: the page a prospect gets, for the sample brand and
// its Chargers fans, made by the same code as a real pitch.
import { DEMO_BRAND, demoData } from "../affinity/demo";
import { pickForTeam } from "../affinity/pick";
import { SAMPLE_STORE, SAMPLE_TEAM } from "../help/samples";
import { buildPitch, type PitchPage } from "./pitch";

/** Sunday 4:41 PM in Los Angeles, as the help pages' samples use. */
const END = new Date("2026-10-18T23:41:00Z");

export function demoPitch(): PitchPage {
  return buildPitch({
    prospect: { name: DEMO_BRAND, domain: new URL(SAMPLE_STORE).host, store_url: SAMPLE_STORE },
    team: SAMPLE_TEAM,
    picks: pickForTeam(demoData().catalog, SAMPLE_TEAM.league, SAMPLE_TEAM.team, 3),
    moment: { id: null, type: "team_win", phase: "after", headline: "Sample: Win", intensity: 0.6, occurredAt: END, gameStart: null, team: SAMPLE_TEAM },
    contact: null,
    link: "/p/demo",
    sender: { name: null, address: null },
    now: END,
  }).page;
}
