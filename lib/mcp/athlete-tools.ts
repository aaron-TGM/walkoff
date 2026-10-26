// Athletes and where they're from: local_athletes for a brand's members,
// and the operator tools that fix a hometown or record a brand's written
// rights to name an athlete. The data comes from the engine's athlete sync
// (engine/athletes) and supabase/009_athletes.sql; before that has run,
// these tools say so.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadAreaCounts } from "../affinity/store";
import {
  ACADEMIES,
  athleteMoments,
  athletePlace,
  athletesInAreas,
  athletesReady,
  clearOperatorHome,
  findAthletes,
  homePlaces,
  loadAthletes,
  momentHomes,
  namingRights,
  placesOf,
  recordRights,
  revokeRights,
  rightsOn,
  savePlaces,
  type Athlete,
  type AthletePlace,
  type Home,
  type RightsRecord,
} from "../athletes";
import { helpUrl } from "../help/pages";
import { NATIONS, placeByKey, placeLabel, resolveTown, townCircle, townCustomers, townLift } from "../places";
import { brandFor, ToolError } from "./data";
import { tourById } from "../tours";
import { teamFromFeedId } from "./teams";
import type { ToolContext } from "./tools";

/** tools.ts's run (or operatorOnly): JSON back to Claude, or the error. */
type Run = (fn: () => Promise<unknown>) => Promise<CallToolResult>;

/** Brands' postal areas a town search starts from, the most customers first. */
const TOP_AREAS = 100;

const NOT_READY = "Walkoff doesn't have athlete data yet. It comes once supabase/009_athletes.sql has run and the engine's athlete sync has read the rosters.";

/** The rule every answer about athletes carries. */
export const ATHLETE_COPY_RULE =
  "Athletes' names are for you, not for campaigns. Campaign copy celebrates the town and never names or describes an athlete: no name, nickname, number, position, school or photo, and nothing like \"hometown hero\". The one exception is an athlete who agreed in writing that this brand may name them (rights on file, in date).";

const SOURCE_WORDS: Record<string, string> = {
  "hometown:operator": "set by Walkoff",
  "hometown:curated": "Walkoff's own research",
  "high_school:wikidata": "high school, from Wikidata",
  "birthplace:espn": "birthplace, from ESPN",
  "birthplace:wikidata": "birthplace, from Wikidata",
};
export const sourceWords = (f: { kind: string; source: string }) => SOURCE_WORDS[`${f.kind}:${f.source}`] ?? `${f.kind.replace("_", " ")}, from ${f.source}`;

const teamName = (a: Athlete) => (a.teamId ? (teamFromFeedId(a.teamId)?.team.name ?? a.teamId) : null);

/** A golfer's tour stands in for a team. */
const teamOrTour = (a: Athlete) => tourById(a.league ?? "")?.name ?? teamName(a) ?? (a.sport === "golf" ? "golf" : "not on a roster now");

function athleteView(a: Athlete) {
  return {
    name: a.displayName,
    id: a.id,
    team: teamOrTour(a),
    position: a.position,
    ...(a.rosterStatus === "reserve" ? { roster: "reserve (injured, practice squad or suspended)" } : {}),
  };
}

const homeView = (h: Home) => ({
  town: `${h.name}, ${h.country === "GB" ? (NATIONS[h.region] ?? "UK") : h.region}`,
  place_key: h.placeKey,
  sure: h.confidence,
  from: h.from.map(sourceWords),
});

async function oneAthlete(ctx: ToolContext, query: string): Promise<Athlete> {
  const found = await findAthletes(ctx.db, query);
  if (found.length === 1) return found[0];
  if (!found.length) throw new ToolError(`Walkoff has no athlete called ${query}. Check the spelling: it needs the full name as rosters have it, or Walkoff's id for them.`);
  throw new ToolError(
    `More than one athlete is called ${query}: ${found.map((a) => `${a.displayName} (${teamName(a) ?? "no team now"}, ${a.position ?? "no position"}), id ${a.id}`).join("; ")}. Say which with the id.`,
  );
}

/** A town an operator typed, or why it isn't one. */
async function townFrom(text: string) {
  const r = await resolveTown(text);
  if (r.status === "found") return r;
  if (r.status === "ambiguous") {
    throw new ToolError(`${text} could be ${r.candidates.map(placeLabel).join("; ")}. Add the state or province, or give a postal code.`);
  }
  if (r.status === "outside") throw new ToolError(`${text} is outside the US, Canada and the UK, where Walkoff works.`);
  throw new ToolError(`Walkoff can't find ${text}. Try "Town, ST" (like "San Clemente, CA") or a postal code.`);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day: not "2026-02-30" or "2026-13-45". */
function isDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return DATE.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function rightsView(r: RightsRecord, today: string) {
  const status = r.revokedAt ? "revoked" : r.startsOn > today ? "not started" : r.endsOn < today ? "ended" : "in date";
  return { starts_on: r.startsOn, ends_on: r.endsOn, evidence: r.evidence, recorded_by: r.recordedBy, status };
}

// ── For a brand's members ──────────────────────────────────────────

export function registerAthleteTools(server: McpServer, ctx: ToolContext, run: Run): void {
  const { db, principal } = ctx;

  server.registerTool(
    "local_athletes",
    {
      title: "Local athletes",
      description:
        "Athletes Walkoff follows who are from towns near the brand's customers, town by town: about how many of the brand's customers live in each town's circle, how much more than its share of people that is, and for each athlete their team, position, how Walkoff knows where they're from, and any rights on file to name them. The names are for the marketer: campaign copy never names or describes an athlete without written rights.",
      inputSchema: {
        brand: z.string().optional().describe("Brand name or id. Optional when you have one brand."),
        limit: z.number().int().min(1).max(50).optional().describe("How many towns to show, the most customers first. Default 20."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        if (!(await athletesReady(db))) return { brand: b.name, towns: [], note: NOT_READY };
        const counts = await loadAreaCounts(db, b.id);
        if (!counts.length) {
          throw new ToolError(
            `${b.name} has no customer counts yet, so Walkoff can't tell which towns are near its customers. Set it up from Shopify in Claude: ${helpUrl(ctx.origin, "shopify", "customers")}`,
          );
        }
        const top = [...counts].filter((c) => c.customers > 0).sort((x, y) => y.customers - x.customers).slice(0, TOP_AREAS);
        const ids = await athletesInAreas(db, top);
        const [athletes, places, rights] = await Promise.all([loadAthletes(db, ids), placesOf(db, ids), namingRights(db, b.id, ids)]);
        const byAthlete = new Map<string, AthletePlace[]>();
        for (const p of places) byAthlete.set(p.athleteId, [...(byAthlete.get(p.athleteId) ?? []), p]);

        const towns = new Map<string, { athletes: { a: Athlete; h: Home }[] }>();
        for (const a of athletes) {
          for (const h of momentHomes(byAthlete.get(a.id) ?? [], ACADEMIES)) {
            const t = towns.get(h.placeKey) ?? { athletes: [] };
            t.athletes.push({ a, h });
            towns.set(h.placeKey, t);
          }
        }
        const rows = [];
        for (const [key, t] of towns) {
          const place = await placeByKey(key);
          if (!place) continue;
          const circle = await townCircle(place);
          const customers = townCustomers(circle, counts);
          if (customers <= 0) continue;
          rows.push({
            town: placeLabel(place),
            circle: `${circle.radiusMiles} miles around ${circle.ref}`,
            customers_estimate: customers,
            lift: townLift(circle, counts),
            ...(circle.bigCity ? { big_city: "Over 750,000 people in the circle: no hometown moments here unless Walkoff sets the home by hand." } : {}),
            athletes: t.athletes
              .sort((x, y) => y.h.confidence - x.h.confidence || x.a.displayName.localeCompare(y.a.displayName))
              .map(({ a, h }) => {
                const r = rights.get(a.id);
                return {
                  ...athleteView(a),
                  how_walkoff_knows: h.from.map(sourceWords),
                  sure: h.confidence,
                  ...(r ? { may_name: `Yes, through ${r.endsOn}, within the agreement` } : {}),
                };
              }),
          });
        }
        rows.sort((x, y) => y.customers_estimate - x.customers_estimate || x.town.localeCompare(y.town));
        return {
          brand: b.name,
          copy_rule: ATHLETE_COPY_RULE,
          how_to_read:
            "customers_estimate is about how many of your customers live in the town's circle, worked out from where your customers are by postal area; Klaviyo's count for the same circle is the real one. lift is how many times its share of people that is. sure is how sure Walkoff is of the hometown, from 0 to 1.",
          towns: rows.slice(0, args.limit ?? 20),
          towns_found: rows.length,
          athletes_found: rows.reduce((s, r) => s + r.athletes.length, 0),
        };
      }),
  );
}

// ── For Walkoff operators ──────────────────────────────────────────

const athleteArg = z.string().describe('The athlete\'s full name, like "Sam Darnold", or Walkoff\'s id for them, like "espn:football:3912547".');

export function registerAthleteOperatorTools(server: McpServer, ctx: ToolContext, operatorOnly: Run): void {
  const { db, principal } = ctx;

  server.registerTool(
    "set_athlete_home",
    {
      title: "Set an athlete's hometown",
      description:
        "Walkoff operators only. Sets where an athlete is from when Walkoff has it wrong, which outranks every source, or clears what an operator set so the sources decide again. A note on where you learned it is required. Shows the athlete's homes before and after, and recent moments about them.",
      inputSchema: {
        athlete: athleteArg,
        hometown: z.string().max(100).optional().describe('The town, like "San Clemente, CA", or a postal code. Leave it out to clear.'),
        clear: z.boolean().optional().describe("Take away the hometown an operator set."),
        note: z.string().min(1).max(500).describe("Where you learned it: a link to a bio, or the athlete's own words."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      operatorOnly(async () => {
        if (!(await athletesReady(db))) throw new ToolError(NOT_READY);
        if (!args.clear && !args.hometown) throw new ToolError("Give a hometown, or clear: true to take one away.");
        if (args.clear && args.hometown) throw new ToolError("Give a hometown or clear: true, not both.");
        const a = await oneAthlete(ctx, args.athlete);
        const before = homePlaces(await placesOf(db, [a.id]), ACADEMIES);
        if (args.clear) await clearOperatorHome(db, a.id);
        else {
          const town = await townFrom(args.hometown!);
          await savePlaces(db, [athletePlace(a.id, "hometown", "operator", args.hometown!, town, args.note)], principal.email);
        }
        const after = homePlaces(await placesOf(db, [a.id]), ACADEMIES);
        const since = new Date(ctx.now().getTime() - 7 * 24 * 3_600_000).toISOString();
        return {
          athlete: athleteView(a),
          homes_before: before.map(homeView),
          homes_now: after.map(homeView),
          recent_moments: (await athleteMoments(db, a.id, since)).map((m) => ({ id: m.id, headline: m.headline, place_key: m.placeKey, detected_at: m.detectedAt })),
          next: "New hometown moments use the home now, and titles from the last 72 hours get the new town's moment within a few minutes. A moment already made for the old town stays in brands' queues: retract_moment takes it back if it's wrong.",
        };
      }),
  );

  server.registerTool(
    "record_athlete_rights",
    {
      title: "Record a brand's rights to name an athlete",
      description:
        "Walkoff operators only. Records that an athlete agreed in writing (an NIL or sponsor deal) that a brand may name them, with the agreement's dates and where it is, or revokes what's on file. While it's in date, that brand's campaigns may name the athlete within the agreement. Without it, they never do.",
      inputSchema: {
        brand: z.string().describe("The brand's exact name or id."),
        athlete: athleteArg,
        starts_on: z.string().optional().describe('When the agreement starts, like "2026-01-01".'),
        ends_on: z.string().optional().describe('When it ends, like "2026-12-31".'),
        evidence: z.string().max(500).optional().describe("Where the signed agreement is: a contract id or a link. Required to record."),
        revoke: z.boolean().optional().describe("Revoke every agreement on file for this brand and athlete."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      operatorOnly(async () => {
        if (!(await athletesReady(db))) throw new ToolError(NOT_READY);
        const b = await brandFor(db, principal, args.brand, { exact: true });
        const a = await oneAthlete(ctx, args.athlete);
        const today = ctx.now().toISOString().slice(0, 10);
        let revoked: number | undefined;
        if (args.revoke) revoked = await revokeRights(db, b.id, a.id, ctx.now().toISOString());
        else {
          const evidence = args.evidence?.trim();
          if (!args.starts_on || !args.ends_on || !evidence) {
            throw new ToolError("To record rights, give starts_on, ends_on and evidence: where the signed agreement is. To take them away, revoke: true.");
          }
          if (!isDate(args.starts_on) || !isDate(args.ends_on)) throw new ToolError("Give the dates like 2026-01-01.");
          if (args.ends_on < args.starts_on) throw new ToolError("ends_on is before starts_on.");
          await recordRights(db, { brandId: b.id, athleteId: a.id, startsOn: args.starts_on, endsOn: args.ends_on, evidence, recordedBy: principal.email });
        }
        const on = (await rightsOn(db, b.id, a.id)).map((r) => rightsView(r, today));
        return {
          brand: b.name,
          athlete: athleteView(a),
          ...(revoked !== undefined ? { revoked } : {}),
          rights_on_file: on,
          rule: on.some((r) => r.status === "in date")
            ? `${b.name}'s campaigns may name ${a.displayName} while the agreement is in date, within what it allows. Get the athlete's OK for each use, and use photos only if the agreement covers them.`
            : `${b.name}'s campaigns never name ${a.displayName}: there's no agreement in date.`,
        };
      }),
  );
}
