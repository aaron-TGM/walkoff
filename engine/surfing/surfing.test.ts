import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { CURATED_HOMES } from "../../lib/athletes";
import type { HometownDetail } from "../../lib/hometown";
import { fakeDb, type Row } from "../../lib/testing/fake-db";
import { tourById } from "../../lib/tours";
import { birthplacesQuery, parseBirthplaces } from "../athletes/wikidata";
import { CIRCUIT_POLL } from "../circuits/poller";
import { seasonTitle, type SurfingFeed } from "./feed";
import { parseSeason, waitingPeriod, type SurfEvent } from "./normalize";
import { isFinale, SURFING, surfingOutcome } from "./outcome";
import { surferId, SurfingPoller } from "./poller";

const ARTICLE = readFileSync(new URL("../__fixtures__/wikipedia-wsl-2026.wiki", import.meta.url), "utf8");
const WIKIDATA = JSON.parse(readFileSync(new URL("../__fixtures__/wikidata-surfers-2026.json", import.meta.url), "utf8"));
const WSL = tourById("wsl")!;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const season = () => parseSeason(ARTICLE, 2026);
const event = (name: string) => season().find((e) => e.name === name)!;
const names = (e: SurfEvent, list: "champions" | "players" = "champions") => e[list].map((s) => s.name);

/** The 2026 article with the Portugal row as it read before its finals. */
const beforePortugal = ARTICLE.replace(
  /(\[\[MEO Rip Curl Pro Portugal\]\]\n)\|[^\n]*\n\|[^\n]*\n\|[^\n]*\n\|[^\n]*\n/,
  "$1|\n|\n|\n|\n",
);

describe("parseSeason, on the real 2026 article", () => {
  it("reads every event in order, with its waiting period and champions", () => {
    const events = season();
    assert.deepEqual(
      events.map((e) => [e.name, e.state]),
      [
        ["Rip Curl Pro Bells Beach", "final"],
        ["Western Australia Margaret River Pro", "final"],
        ["Bonsoy Gold Coast Pro", "final"],
        ["Corona Cero New Zealand Pro", "final"],
        ["Surf City El Salvador Pro", "final"],
        ["VIVO Rio Pro", "final"],
        ["Outerknown Tahiti Pro", "final"],
        ["Fiji Pro", "final"],
        ["Lexus Trestles Pro", "final"],
        ["MEO Rip Curl Pro Portugal", "final"],
        ["Philippines Pro", "pre"],
        ["Surf Abu Dhabi", "off"],
        ["Lexus Pipe Masters", "pre"],
      ],
    );
    const bells = events[0];
    assert.deepEqual([bells.startsOn, bells.endsOn, bells.key, bells.id], ["2026-04-01", "2026-04-11", "surfing:rip-curl-pro:2026", "wikipedia:surfing:2026:rip-curl-pro"]);
    assert.deepEqual(names(bells), ["Miguel Pupo", "Gabriela Bryan"]);
    assert.equal(bells.statusLine, "Champions: Miguel Pupo and Gabriela Bryan");
  });

  it("knows an event by its article, so the schedule and the results agree", () => {
    const pipe = event("Lexus Pipe Masters");
    assert.deepEqual([pipe.key, pipe.startsOn, pipe.endsOn, pipe.statusLine], ["surfing:billabong-pipeline-masters:2026", "2026-12-08", "2026-12-20", "Waiting period 2026-12-08 to 2026-12-20"]);
    assert.equal(event("Surf Abu Dhabi").statusLine, "Canceled");
    assert.deepEqual([event("Fiji Pro").startsOn, event("Fiji Pro").endsOn], ["2026-08-25", "2026-09-04"], "across two months");
    assert.deepEqual([event("Philippines Pro").startsOn, event("Philippines Pro").endsOn], ["2026-10-31", "2026-11-10"], "with a hyphen");
  });

  it("keeps each surfer's article, and their name without its disambiguation", () => {
    const portugal = event("MEO Rip Curl Pro Portugal");
    assert.deepEqual(names(portugal, "players"), ["Griffin Colapinto", "Molly Picklum", "Gabriel Medina", "Caitlin Simmers"]);
    const [fioravanti] = event("Surf City El Salvador Pro").champions;
    assert.deepEqual(fioravanti, { externalId: "Leonardo Fioravanti (surfer)", name: "Leonardo Fioravanti" });
    assert.equal(surferId(fioravanti.externalId), "walkoff:surfing:leonardo-fioravanti");
    assert.equal(surferId("Ítalo Ferreira"), "walkoff:surfing:italo-ferreira");
  });

  it("an event with one final done is under way; one with none hasn't started", () => {
    const half = ARTICLE.replace("|{{Flagicon|AUS}} [[Molly Picklum]]\n|{{Flagicon|USA}} [[Caitlin Simmers]]", "|\n|");
    const portugal = parseSeason(half, 2026).find((e) => e.name === "MEO Rip Curl Pro Portugal")!;
    assert.deepEqual([portugal.state, names(portugal)], ["in", ["Griffin Colapinto"]]);
    const before = parseSeason(beforePortugal, 2026).find((e) => e.name === "MEO Rip Curl Pro Portugal")!;
    assert.deepEqual([before.state, before.players], ["pre", []]);
  });

  it("reads cells however they're written, and no champion from a placeholder", () => {
    const article = `== Schedule ==
{| class="wikitable"
! Round !! Dates !! Event
|-
! 1 || 25 August – 4 September || [[Fiji Pro]]<ref name="x">A source</ref>
|-
! 2
| style="white-space:nowrap" | 11–20 September
| [[Hurley Pro at Trestles|Lexus Trestles Pro]]
|}

=== Event results ===
{| class="wikitable"
!Round!!Event!!Men's champion!!Women's champion
|-
!1
|[[Fiji Pro]]
|{{flagicon|USA}} '''[[Cole Houshmand]]'''
|John Doe
|-
!2
|[[Hurley Pro at Trestles|Lexus Trestles Pro]]
|TBD
|[[Erin Brooks]]
|}`;
    const [fiji, trestles] = parseSeason(article, 2026);
    assert.deepEqual([fiji.startsOn, fiji.endsOn, names(fiji), fiji.state], ["2026-08-25", "2026-09-04", ["Cole Houshmand", "John Doe"], "final"]);
    assert.deepEqual([trestles.startsOn, trestles.endsOn, names(trestles), trestles.state], ["2026-09-11", "2026-09-20", ["Erin Brooks"], "in"]);
  });
});

describe("waitingPeriod", () => {
  it("reads dates month first or day first, across months, and refuses the rest", () => {
    assert.deepEqual(waitingPeriod("April 1–11", 2026), { startsOn: "2026-04-01", endsOn: "2026-04-11" });
    assert.deepEqual(waitingPeriod("August 25 – September 4", 2026), { startsOn: "2026-08-25", endsOn: "2026-09-04" });
    assert.deepEqual(waitingPeriod("October 31 - November 10", 2026), { startsOn: "2026-10-31", endsOn: "2026-11-10" });
    assert.deepEqual(waitingPeriod("1–11 April", 2026), { startsOn: "2026-04-01", endsOn: "2026-04-11" });
    assert.deepEqual(waitingPeriod("Sept. 11–20", 2026), { startsOn: "2026-09-11", endsOn: "2026-09-20" });
    assert.deepEqual(waitingPeriod("<s>November 25–29</s>", 2026), { startsOn: "2026-11-25", endsOn: "2026-11-29" });
    for (const t of ["TBD", "February 30", "April 11–1", ""]) assert.equal(waitingPeriod(t, 2026), null, t);
  });
});

describe("surfingOutcome", () => {
  const portugal = () => event("MEO Rip Curl Pro Portugal");
  const end = Date.parse("2026-10-25T23:59:59Z");

  it("both champions, one outcome, for 60 hours after the waiting period", () => {
    const o = surfingOutcome(portugal(), WSL, end + 2 * HOUR)!;
    assert.deepEqual([o.kind, o.eventKey, o.eventName, o.players.map((p) => p.name), o.intensity, o.startsAt], [
      "win",
      "surfing:meo-rip-curl-pro-portugal:2026",
      "MEO Rip Curl Pro Portugal",
      ["Griffin Colapinto", "Molly Picklum"],
      WSL.winIntensity,
      null,
    ]);
    assert.equal(surfingOutcome(portugal(), WSL, end + 61 * HOUR), null);
    assert.equal(surfingOutcome(event("Lexus Trestles Pro"), WSL, end), null, "September's is long over");
  });

  it("the Pipe Masters counts for more; a canceled event or one without dates for nothing", () => {
    assert.ok(isFinale("Lexus Pipe Masters") && isFinale("Billabong Pipeline Masters") && !isFinale("Pipeline Pro"));
    const pipe = { ...event("Lexus Pipe Masters"), state: "final" as const, champions: portugal().champions };
    assert.equal(surfingOutcome(pipe, WSL, Date.parse("2026-12-20T20:00:00Z"))?.intensity, SURFING.finale);
    assert.equal(surfingOutcome({ ...portugal(), state: "off" }, WSL, end), null);
    assert.equal(surfingOutcome({ ...portugal(), endsOn: null }, WSL, end), null);
  });
});

describe("Wikidata birthplaces by article", () => {
  it("reads each surfer's birthplace, and knows when it has none", () => {
    const found = parseBirthplaces(WIKIDATA);
    assert.deepEqual(found.get("Griffin Colapinto"), { item: "Q61789289", birthplace: { name: "San Clemente", lat: 33.437777777, lng: -117.620277777, country: "US" } });
    assert.deepEqual(found.get("Molly Picklum")?.birthplace?.country, "outside");
    assert.deepEqual(found.get("Gabriela Bryan"), { item: "Q125556200", birthplace: null });
    assert.equal(found.has("Nobody Here"), false);
    assert.match(birthplacesQuery(["Connor O'Leary", 'A "quoted" name']), /"Connor O'Leary"@en "A \\"quoted\\" name"@en/);
  });

  it("the curated file's surfers are the ones the feed knows", () => {
    for (const h of CURATED_HOMES.filter((x) => x.athlete.startsWith("walkoff:surfing:"))) assert.equal(h.athlete, surferId(h.name));
  });
});

describe("SurfingPoller", () => {
  const feedOf = (text: string | null): SurfingFeed & { years: number[]; asked: string[][] } => {
    const years: number[] = [];
    const asked: string[][] = [];
    const known = parseBirthplaces(WIKIDATA);
    return {
      years,
      asked,
      season: async (year) => {
        years.push(year);
        return text;
      },
      birthplaces: async (titles) => {
        asked.push(titles);
        return new Map(titles.flatMap((t) => (known.has(t) ? [[t, known.get(t)!] as const] : [])));
      },
    };
  };
  const moments = (db: { tables: Record<string, Row[]> }) => (db.tables.moments ?? []).filter((m) => String(m.type).startsWith("hometown_"));
  const COLAPINTO = "walkoff:surfing:griffin-colapinto";

  it("Portugal: once the article has named them for half an hour, San Clemente gets Griffin Colapinto's win", async () => {
    const db = fakeDb({});
    let now = Date.parse("2026-10-26T18:00:00Z");
    const feed = feedOf(ARTICLE);
    const p = new SurfingPoller(WSL, db, feed, { hometown: true, now: () => now });
    assert.equal(await p.tick(), CIRCUIT_POLL.idle);
    assert.deepEqual(feed.years, [2026]);
    assert.equal(seasonTitle(2026), "2026 World Surf League");
    assert.equal(db.tables.athletes.find((a) => a.id === COLAPINTO)?.league, "wsl");
    assert.equal(db.tables.athletes.find((a) => a.id === COLAPINTO)?.external_id, "Griffin Colapinto");
    assert.equal((db.tables.athlete_results ?? []).length, 0, "not yet: a champion has to stay named for a while");

    now += 31 * MINUTE;
    await p.tick();
    const results = db.tables.athlete_results.map((r) => [r.athlete_id, r.kind, r.intensity, r.event_name]);
    assert.deepEqual(results, [
      [COLAPINTO, "win", WSL.winIntensity, "MEO Rip Curl Pro Portugal"],
      ["walkoff:surfing:molly-picklum", "win", WSL.winIntensity, "MEO Rip Curl Pro Portugal"],
    ]);
    const born = db.tables.athlete_places.find((x) => x.athlete_id === COLAPINTO)!;
    assert.deepEqual([born.kind, born.source, born.raw, born.resolution, born.place_name], ["birthplace", "wikidata", "San Clemente", "found", "San Clemente"]);
    assert.equal(db.tables.athlete_places.find((x) => x.athlete_id === "walkoff:surfing:molly-picklum")?.resolution, "outside");
    const [m] = moments(db);
    assert.equal(m.headline, "Hometown win: Griffin Colapinto won the MEO Rip Curl Pro Portugal · San Clemente, CA");
    assert.deepEqual([m.league, m.intensity, m.phase, m.athlete_id], ["wsl", WSL.winIntensity, "season", COLAPINTO]);
    assert.equal((m.detail as HometownDetail).event.name, "MEO Rip Curl Pro Portugal");

    now += 10 * MINUTE;
    await p.tick();
    assert.equal(moments(db).length, 1, "a repeat adds nothing");
    assert.equal(db.tables.engine_heartbeats[0].league, "surfing:wsl");
    assert.ok(feed.asked.every((t) => t.length === 1), "one surfer at a time");
  });

  it("a name that's there one poll and gone the next is never a champion", async () => {
    const db = fakeDb({});
    let now = Date.parse("2026-10-26T18:00:00Z");
    const feed = feedOf(ARTICLE.replace("[[Griffin Colapinto]]\n|{{Flagicon|BRA}} [[Gabriel Medina]]", "[[Someone Else]]\n|{{Flagicon|BRA}} [[Gabriel Medina]]"));
    const p = new SurfingPoller(WSL, db, feed, { hometown: true, now: () => now });
    await p.tick();
    (feed as { season: SurfingFeed["season"] }).season = async () => ARTICLE;
    now += 10 * MINUTE;
    await p.tick();
    now += 25 * MINUTE;
    await p.tick();
    assert.deepEqual(
      db.tables.athlete_results.map((r) => r.athlete_id),
      ["walkoff:surfing:molly-picklum"],
      "named from the start; Griffin Colapinto only 25 minutes",
    );
    now += 10 * MINUTE;
    await p.tick();
    assert.deepEqual(db.tables.athlete_results.map((r) => r.athlete_id).sort(), [COLAPINTO, "walkoff:surfing:molly-picklum"]);
    assert.ok(!db.tables.athlete_results.some((r) => r.athlete_id === "walkoff:surfing:someone-else"));
  });

  it("before the finals, and with no article yet, makes nothing", async () => {
    const db = fakeDb({});
    let now = Date.parse("2026-10-24T18:00:00Z");
    const p = new SurfingPoller(WSL, db, feedOf(beforePortugal), { hometown: true, now: () => now });
    await p.tick();
    now += HOUR;
    await p.tick();
    assert.equal((db.tables.athlete_results ?? []).length, 0);

    const none = fakeDb({});
    const q = new SurfingPoller(WSL, none, feedOf(null), { hometown: true, now: () => Date.parse("2027-01-02T00:00:00Z") });
    assert.equal(await q.tick(), CIRCUIT_POLL.idle);
    assert.equal(none.tables.engine_heartbeats[0].games, 0);
  });
});
