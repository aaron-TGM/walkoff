// Operator tools for hometown moments: create_moment records a win Walkoff
// doesn't follow itself and makes the moment for each town the athlete is
// from right away; retract_moment takes a wrong moment back out of every
// queue. Registered only for Walkoff operators (tools.ts).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { athletePlace, athletesReady, findAthletes, loadAthletes, saveAthletes, savePlaces, saveResults, type Athlete, type AthleteResult } from "../athletes";
import { makeHometownMoments } from "../hometown";
import { placeLabel, resolveTown } from "../places";
import { brandsFor, has009, momentById, ToolError } from "./data";
import { teamFromFeedId } from "./teams";
import type { ToolContext } from "./tools";

type Run = (fn: () => Promise<unknown>) => Promise<CallToolResult>;

const NOT_READY = "Walkoff doesn't have athlete data yet. It comes once supabase/009_athletes.sql has run.";

const SPORTS = ["golf", "tennis", "racing", "surfing", "football", "basketball", "baseball", "hockey", "soccer", "other"] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return DATE.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** "griffin-colapinto". */
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** An athlete Walkoff doesn't follow, for create_moment: "walkoff:surfing:griffin-colapinto". */
const walkoffId = (sport: string, name: string) => `walkoff:${sport}:${slug(name)}`;

export function registerHometownOperatorTools(server: McpServer, ctx: ToolContext, operatorOnly: Run): void {
  const { db, principal } = ctx;

  server.registerTool(
    "create_moment",
    {
      title: "Create a hometown moment",
      description:
        "Walkoff operators only. Records a win Walkoff doesn't follow itself, like a surfing win or a medal, and makes the moment for each town the athlete is from right away, for brands with customers there. The athlete is one Walkoff knows from a roster, or someone new: then give their sport and hometown. A note on where you learned it is required.",
      inputSchema: {
        athlete: z.string().min(2).max(100).describe('The athlete\'s full name, like "Griffin Colapinto", or Walkoff\'s id for them.'),
        event: z.string().min(2).max(120).describe('What they won, for the marketer\'s eyes: "WSL Finals". Never in campaign copy.'),
        date: z.string().describe('When they won, like "2026-09-10".'),
        note: z.string().min(1).max(500).describe("Where you learned it: a link to the result, and for someone new, to where they're from."),
        sport: z.enum(SPORTS).optional().describe("For someone Walkoff doesn't know yet."),
        hometown: z.string().max(100).optional().describe('For someone Walkoff doesn\'t know yet: their town, like "San Clemente, CA", or a postal code.'),
        intensity: z.number().min(0).max(1).optional().describe("How big a win it is, from 0 to 1. Default 0.85; a major is 0.95."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      operatorOnly(async () => {
        if (!(await athletesReady(db))) throw new ToolError(NOT_READY);
        if (!isDate(args.date)) throw new ToolError("Give the date like 2026-09-10.");
        const now = ctx.now();
        if (args.date > now.toISOString().slice(0, 10)) throw new ToolError("That date hasn't happened yet.");

        // Who: someone Walkoff knows, or someone new with a hometown.
        const found = await findAthletes(db, args.athlete);
        let a: Athlete;
        if (found.length > 1) {
          throw new ToolError(`More than one athlete is called ${args.athlete}: ${found.map((x) => `${x.displayName} (${x.id})`).join("; ")}. Say which with the id.`);
        } else if (found.length === 1) {
          if (args.hometown) throw new ToolError(`Walkoff knows ${found[0].displayName} already. To change where they're from, use set_athlete_home first.`);
          a = found[0];
        } else {
          if (!args.sport || !args.hometown) {
            throw new ToolError(`Walkoff has no athlete called ${args.athlete}. To add them, give their sport and hometown too.`);
          }
          const town = await resolveTown(args.hometown);
          if (town.status !== "found") {
            throw new ToolError(
              town.status === "ambiguous"
                ? `${args.hometown} could be ${town.candidates.map(placeLabel).join("; ")}. Add the state or province, or give a postal code.`
                : town.status === "outside"
                  ? `${args.hometown} is outside the US, Canada and the UK, where Walkoff works.`
                  : `Walkoff can't find ${args.hometown}. Try "Town, ST" (like "San Clemente, CA") or a postal code.`,
            );
          }
          const id = walkoffId(args.sport, args.athlete);
          a = { id, sport: args.sport, league: null, externalId: slug(args.athlete), displayName: args.athlete.trim(), teamId: null, position: null, jersey: null, rosterStatus: null, college: null };
          const known = await loadAthletes(db, [id]);
          if (!known.length) await saveAthletes(db, [a], now.toISOString());
          await savePlaces(db, [athletePlace(id, "hometown", "operator", args.hometown, town, args.note)], principal.email);
        }

        // The result, then a moment for each town they're from.
        const at = new Date(`${args.date}T12:00:00Z`);
        const occurredAt = (at.getTime() > now.getTime() ? now : at).toISOString();
        const result: AthleteResult = {
          athleteId: a.id,
          eventKey: `walkoff:${slug(args.event)}:${args.date}`,
          eventName: args.event.trim(),
          kind: "win",
          role: "leader",
          teamId: null,
          momentId: null,
          intensity: args.intensity ?? 0.85,
          occurredAt,
          createdBy: principal.email,
        };
        await saveResults(db, [result]);
        const { moments, saved, homes } = await makeHometownMoments(
          db,
          {
            key: result.eventKey,
            name: result.eventName,
            kind: "win",
            league: a.league ?? a.sport,
            gameId: null,
            teamId: null,
            teamName: null,
            opponentTeamId: null,
            occurredAt,
          },
          [result],
        );
        const made = new Set(saved.map((m) => m.dedupeKey));
        return {
          athlete: { name: a.displayName, id: a.id, team: a.teamId ? (teamFromFeedId(a.teamId)?.team.name ?? a.teamId) : null },
          event: result.eventName,
          towns: moments.map((m) => ({ town: m.detail.town.label, headline: m.headline, new: made.has(m.dedupeKey), big_city: m.detail.town.big_city })),
          ...(moments.length
            ? {}
            : {
                note: homes
                  ? "Their home is a big city, where Walkoff makes no hometown moments unless the home was set by hand."
                  : "Walkoff isn't sure enough where they're from to make a moment. set_athlete_home sets it, then run this again.",
              }),
          next: saved.length ? "Brands with customers near the town see it in trigger_queue now." : "Nothing new: those towns had this moment already.",
        };
      }),
  );

  server.registerTool(
    "retract_moment",
    {
      title: "Retract a moment",
      description:
        "Walkoff operators only. Takes a wrong moment back, like a hometown moment for the wrong town, so it's in no brand's queue and build_campaign refuses it. A reason is required. Lists the brands that already drafted or sent it, so you can tell them.",
      inputSchema: {
        moment_id: z.string().describe("From trigger_queue or recent_moments."),
        reason: z.string().min(1).max(300).describe("Why it's wrong, for the record."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      operatorOnly(async () => {
        if (!(await has009(db))) throw new ToolError("Retracting needs supabase/009_athletes.sql to have run.");
        const m = await momentById(db, args.moment_id);
        if (!m) throw new ToolError("No moment with that id.");
        const at = m.retracted_at ?? ctx.now().toISOString();
        if (!m.retracted_at) {
          const { error } = await db.from("moments").update({ retracted_at: at, retracted_reason: args.reason.trim() }).eq("id", m.id);
          if (error) throw error;
        }
        const { data, error } = await db.from("sends").select("brand_id, status, created_at").eq("moment_id", m.id);
        if (error) throw error;
        const brands = new Map((await brandsFor(db, principal)).map((b) => [b.id, b.name]));
        const acted = ((data ?? []) as { brand_id: string; status: string; created_at: string }[]).map((s) => ({
          brand: brands.get(s.brand_id) ?? s.brand_id,
          status: s.status,
          at: s.created_at,
        }));
        return {
          moment: { id: m.id, headline: m.headline },
          retracted_at: at,
          reason: m.retracted_reason ?? args.reason.trim(),
          ...(m.retracted_at ? { note: "It was retracted already." } : {}),
          brands_that_acted: acted,
          next: acted.length ? "Tell those brands: a draft in Klaviyo should be deleted, and a send can't be taken back." : "No brand had drafted or sent it.",
        };
      }),
  );
}
