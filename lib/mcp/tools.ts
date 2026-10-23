// The Walkoff MCP tools. Each works within the brands the signed-in person
// may use and returns JSON for Claude to read.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { colorFamily } from "../affinity/colors";
import type { AffinityReport } from "../affinity/compute";
import { pickForTeam, type Pick, type PickProduct } from "../affinity/pick";
import { catalogCounts, latestReport, loadAreaCounts, loadTaggedCatalog } from "../affinity/store";
import { TRIGGERS } from "../triggers";
import { teamAudience } from "./audience";
import { buildCampaign, type CampaignMoment } from "./campaign";
import {
  brandFor,
  brandsFor,
  createTrigger,
  deleteTrigger,
  gamesById,
  latestByMoment,
  listTriggers,
  logSend,
  momentById,
  momentsByIds,
  momentView,
  recentMoments,
  sendsFor,
  teamNames,
  ToolError,
  typeName,
  upcomingGames,
  type BrandRow,
  type MomentRow,
  type Principal,
  type TriggerRow,
} from "./data";
import { DEFAULT_RULE, matchingRule, momentWindow, type TriggerRule } from "./queue";
import { feedIdOf, resolveTeam, teamByKey, teamFromFeedId, type TeamRef } from "./teams";
import { formatLocal, teamTimeZone } from "./timing";

export interface ToolContext {
  db: SupabaseClient;
  principal: Principal;
  now: () => Date;
}

const HOUR = 3_600_000;
const MOMENT_TYPES = TRIGGERS.map((t) => t.id) as [string, ...string[]];
const PHASE_OF = new Map(TRIGGERS.map((t) => [t.id, t.category]));

// ── Shared arguments ───────────────────────────────────────────────

const brandArg = z.string().optional().describe("Brand name or id. Optional when you have one brand.");
const teamArg = z.string().describe('A team: "Chargers", "Los Angeles Chargers", "LAC" or a key like "nfl:24".');
const leagueArg = z
  .enum(["nfl", "nba", "nhl", "mlb", "ncaaf", "ncaab", "epl"])
  .optional()
  .describe("Narrows the team when a name is shared (LAC is the Chargers and the Clippers).");
const reachArg = z
  .enum(["core", "wide"])
  .optional()
  .describe('"core" (default): areas where most fans follow the team. "wide": also shared markets where a big minority do.');

// ── Helpers ────────────────────────────────────────────────────────

const json = (value: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });

async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return json(await fn());
  } catch (err) {
    if (err instanceof ToolError) return { isError: true, content: [{ type: "text", text: err.message }] };
    console.error("Walkoff MCP tool failed", err);
    return { isError: true, content: [{ type: "text", text: "Walkoff hit an error reading its data. Try again in a minute." }] };
  }
}

function standoutTeams(report: AffinityReport | null): TeamRef[] {
  return (report?.standouts ?? []).map((g) => teamByKey(`${g.league}:${g.teamId}`)).filter((t): t is TeamRef => !!t);
}

function team(query: string, league: string | undefined, prefer: TeamRef[] = []): TeamRef {
  const r = resolveTeam(query, { league, prefer: prefer.map((t) => t.key) });
  if ("error" in r) throw new ToolError(r.error);
  return r.team;
}

/** The brand when the call names one or there's only one; else null. */
async function maybeBrand(ctx: ToolContext, ref: string | undefined): Promise<BrandRow | null> {
  if (ref) return brandFor(ctx.db, ctx.principal, ref);
  const all = await brandsFor(ctx.db, ctx.principal);
  return all.length === 1 ? all[0] : null;
}

/** The teams a call is about: the one named, or the brand's standouts. */
async function teamsFor(ctx: ToolContext, args: { brand?: string; team?: string; league?: string }) {
  const brand = args.team ? await maybeBrand(ctx, args.brand) : await brandFor(ctx.db, ctx.principal, args.brand);
  const report = brand ? await latestReport(ctx.db, brand.id) : null;
  const standouts = standoutTeams(report);
  if (args.team) return { brand, teams: [team(args.team, args.league, standouts)] };
  if (!standouts.length) {
    throw new ToolError(`${brand!.name} has no standout fan territories yet (it needs a customer upload). Name a team instead.`);
  }
  return { brand, teams: standouts };
}

const productUrl = (store: string | null, handle?: string) =>
  store && handle ? `${store.replace(/\/+$/, "")}/products/${encodeURIComponent(handle)}` : null;

function pickView(p: Pick, store: string | null) {
  return {
    title: p.title,
    colorway: p.colorway,
    why: p.why,
    price: p.price ?? null,
    url: productUrl(store, p.handle),
    image: p.image || null,
    skus: p.skus.slice(0, 10),
  };
}

/** A product the marketer chose, shown even when its colors don't match. */
function plainPick(p: PickProduct): Pick {
  const first = p.colorways?.[0];
  return { handle: p.handle, title: p.title, colorway: null, hex: first?.hex ?? [], skus: [], image: first?.image ?? "", why: "Your pick", score: 0, price: p.price ?? null };
}

function triggerView(t: TriggerRow | TriggerRule) {
  return {
    id: t.id,
    name: t.name,
    moments: t.moment_types.length ? t.moment_types.map(typeName) : ["any moment"],
    moment_types: t.moment_types,
    teams: t.team_keys.length ? t.team_keys.map((k) => teamByKey(k)?.team.name ?? k) : ["the brand's standout teams"],
    team_keys: t.team_keys,
    min_intensity: t.min_intensity,
    active: t.active,
  };
}

async function momentContext(ctx: ToolContext, rows: MomentRow[]) {
  const [names, games] = await Promise.all([
    teamNames(ctx.db, rows.flatMap((r) => [r.team_id, r.opponent_team_id])),
    gamesById(ctx.db, rows.map((r) => r.game_id).filter((x): x is string => !!x)),
  ]);
  return { names, games };
}

function gameStartOf(m: MomentRow, games: Map<string, { starts_at: string }>): Date | null {
  const fromGame = m.game_id ? games.get(m.game_id)?.starts_at : undefined;
  const fromDetail = typeof m.detail?.startsAt === "string" ? m.detail.startsAt : undefined;
  const at = fromGame ?? fromDetail;
  return at ? new Date(at) : null;
}

// ── Tools ──────────────────────────────────────────────────────────

export function registerTools(server: McpServer, ctx: ToolContext): void {
  const { db, principal } = ctx;

  server.registerTool(
    "list_brands",
    {
      title: "List brands",
      description:
        "The brands you can use Walkoff for, with what Walkoff knows about each: store, whether it's licensed to name teams, customers mapped, catalog, and its standout fan territories. Start here.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      run(async () => {
        const brands = await brandsFor(db, principal);
        const rows = await Promise.all(
          brands.map(async (b) => {
            const [report, stats] = await Promise.all([latestReport(db, b.id), catalogCounts(db, b.id)]);
            return {
              id: b.id,
              name: b.name,
              store_url: b.store_url,
              licensed: b.licensed,
              customers_mapped: report?.totals.matchedCustomers ?? 0,
              map_computed_at: report?.computedAt ?? null,
              catalog: stats,
              standout_teams: (report?.standouts ?? []).slice(0, 8).map((g) => ({
                team: g.teamName,
                key: `${g.league}:${g.teamId}`,
                lift: g.lift,
                customers: g.customers,
              })),
            };
          }),
        );
        return {
          signed_in_as: principal.email,
          brands: rows,
          next: rows.length
            ? "trigger_queue shows the moments to act on now. recent_moments shows what just happened."
            : "No brands yet. Ask your Walkoff contact to invite this email.",
        };
      }),
  );

  server.registerTool(
    "get_affinity_map",
    {
      title: "Affinity map",
      description:
        "Where a brand's customers over-index on fan territories. For each standout team: the lift (2.4 means 2.4 times what population alone predicts), customers, what that territory buys more of, and the products to feature when the team has a moment.",
      inputSchema: { brand: brandArg },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const [report, catalog] = await Promise.all([latestReport(db, b.id), loadTaggedCatalog(db, b.id)]);
        if (!report) throw new ToolError(`${b.name} hasn't uploaded customers yet, so there's no map. The upload link is with your Walkoff contact.`);
        return {
          brand: b.name,
          computed_at: report.computedAt,
          customers_mapped: report.totals.matchedCustomers,
          how_to_read: "lift is how many times more customers a territory has than its population predicts; z above 2.5 means it isn't chance.",
          standouts: report.standouts.map((g) => {
            const colors = g.colors ?? teamByKey(`${g.league}:${g.teamId}`)?.team.colors ?? [];
            return {
              team: g.teamName,
              key: `${g.league}:${g.teamId}`,
              league: g.leagueName,
              lift: g.lift,
              z: g.z,
              customers: g.customers,
              share_of_customers: g.share,
              team_colors: colors.map((h) => `#${h} (${colorFamily(h)})`),
              buys_more_of: g.products.map((p) => `${p.product} (${p.lift}x)`),
              feature_on_a_moment: pickForTeam(catalog, g.league, { id: g.teamId, colors }, 3).map((p) => pickView(p, b.store_url)),
            };
          }),
          biggest_by_league: report.leagues.map((l) => ({
            league: l.leagueName,
            customers: l.customers,
            teams: l.teams.slice(0, 3).map((t) => `${t.teamName}: ${t.customers} customers, ${t.lift}x`),
          })),
        };
      }),
  );

  server.registerTool(
    "recent_moments",
    {
      title: "Recent moments",
      description:
        "Moments Walkoff detected for the brand's standout teams, or for one team: walk-off wins, buzzer beaters, comebacks, rivalry wins, heartbreakers, clinches, pre-game rivalries and big games. Each has an id for build_campaign, how long it's worth acting on, and what the brand already did with it. Headlines name teams for the marketer; campaign copy for brands without a license never does.",
      inputSchema: {
        brand: brandArg,
        team: teamArg.optional(),
        league: leagueArg,
        hours: z.number().int().min(1).max(336).optional().describe("How far back to look. Default 48."),
        types: z.array(z.enum(MOMENT_TYPES)).optional().describe("Only these moment types."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const { brand, teams } = await teamsFor(ctx, args);
        const now = ctx.now();
        const rows = await recentMoments(db, {
          teamIds: teams.map(feedIdOf),
          since: new Date(now.getTime() - (args.hours ?? 48) * HOUR),
          types: args.types,
          limit: 100,
        });
        const { names, games } = await momentContext(ctx, rows);
        const acted = brand ? latestByMoment(await sendsFor(db, brand.id, { momentIds: rows.map((r) => r.id) })) : new Map();
        return {
          brand: brand?.name ?? null,
          teams: teams.map((t) => t.team.name),
          moments: rows.map((r) => {
            const gameStart = gameStartOf(r, games);
            return {
              ...momentView(r, names, r.game_id ? games.get(r.game_id) : undefined),
              window: momentWindow({ type: r.type, intensity: r.intensity, occurredAt: new Date(r.occurred_at), gameStart, teamKey: null }, now),
              brand_status: acted.get(r.id)?.status ?? null,
            };
          }),
          ...(rows.length ? {} : { note: "Nothing in this window. The engine watches every game in Walkoff's leagues, every minute or so." }),
        };
      }),
  );

  server.registerTool(
    "upcoming_games",
    {
      title: "Upcoming games",
      description:
        "Upcoming games for the brand's standout teams, or one team, in the fans' local time, with any pre-game moments Walkoff spotted (rivalries, big games, season openers). Use it to plan ahead.",
      inputSchema: {
        brand: brandArg,
        team: teamArg.optional(),
        league: leagueArg,
        days: z.number().int().min(1).max(14).optional().describe("How far ahead. Default 7."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const { brand, teams } = await teamsFor(ctx, args);
        const now = ctx.now();
        const ids = teams.map(feedIdOf);
        const [games, pre] = await Promise.all([
          upcomingGames(db, ids, now, new Date(now.getTime() + (args.days ?? 7) * 24 * HOUR)),
          recentMoments(db, { teamIds: ids, since: new Date(now.getTime() - 72 * HOUR), types: ["rivalry_preview", "big_game_alert", "season_opener"], limit: 200 }),
        ]);
        const names = await teamNames(db, games.flatMap((g) => [g.home_team_id, g.away_team_id]));
        return {
          brand: brand?.name ?? null,
          games: games.map((g) => {
            const ours = teams.filter((t) => feedIdOf(t) === g.home_team_id || feedIdOf(t) === g.away_team_id);
            const tz = teamTimeZone(ours[0].team);
            return {
              game_id: g.id,
              matchup: `${names.get(g.away_team_id) ?? g.away_team_id} at ${names.get(g.home_team_id) ?? g.home_team_id}`,
              league: g.league,
              starts_at: g.starts_at,
              starts_local: formatLocal(new Date(g.starts_at), tz),
              headline: g.headline,
              for_teams: ours.map((t) => t.team.name),
              moments: pre
                .filter((m) => m.game_id === g.id && ours.some((t) => feedIdOf(t) === m.team_id))
                .map((m) => ({ id: m.id, type: m.type, type_name: typeName(m.type), headline: m.headline })),
            };
          }),
          note: "Walkoff sees each league's current scoreboard, so games more than a few days out may not be listed yet.",
        };
      }),
  );

  server.registerTool(
    "match_products",
    {
      title: "Match products to a team",
      description:
        "The brand's products to feature for a team: anything made for its fans first, then the colorways closest to the team's colors, one per team color. No license needed: it's the brand's own products in the colors fans are wearing.",
      inputSchema: {
        brand: brandArg,
        team: teamArg,
        league: leagueArg,
        limit: z.number().int().min(1).max(6).optional().describe("How many products. Default 3."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const [report, catalog] = await Promise.all([latestReport(db, b.id), loadTaggedCatalog(db, b.id)]);
        const t = team(args.team, args.league, standoutTeams(report));
        const picks = pickForTeam(catalog, t.league, t.team, args.limit ?? 3);
        return {
          brand: b.name,
          team: t.team.name,
          team_colors: t.team.colors.map((h) => ({ hex: `#${h}`, name: colorFamily(h) })),
          picks: picks.map((p) => pickView(p, b.store_url)),
          ...(picks.length
            ? {}
            : { note: catalog.length ? "Nothing in the catalog is close to the team's colors." : "No catalog yet: upload a Shopify product export." }),
        };
      }),
  );

  server.registerTool(
    "get_territory",
    {
      title: "Team audience",
      description:
        "A team's fan territory as a Klaviyo segment: one to three circles for Klaviyo's \"Someone's proximity to a location\" condition (each a real postal code and a radius), UK outward codes for clubs, how well it covers the team's fans, and how many of the brand's customers live there. Create the segment once per team in Klaviyo; every later moment reuses it.",
      inputSchema: { brand: brandArg, team: teamArg, league: leagueArg, reach: reachArg },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const brand = await maybeBrand(ctx, args.brand);
        const [report, areas] = brand ? await Promise.all([latestReport(db, brand.id), loadAreaCounts(db, brand.id)]) : [null, null];
        const t = team(args.team, args.league, standoutTeams(report));
        const customersByArea = areas ? new Map(areas.map((a) => [`${a.country}:${a.area}`, a.customers])) : undefined;
        return { brand: brand?.name ?? null, team: t.team.name, key: t.key, ...teamAudience(t, { reach: args.reach, customersByArea }) };
      }),
  );

  server.registerTool(
    "build_campaign",
    {
      title: "Build a campaign",
      description:
        "A ready-to-draft campaign for a moment: subject lines, preview text, a finished Klaviyo email (HTML with unsubscribe and address tags), the products with links, the audience segment, when to send in the fans' time zone, copy rules and the steps to draft it with the Klaviyo connector. Polish the words if you like, but keep the copy rules. Pass a moment_id from trigger_queue or recent_moments, or a team and moment_type for a sample.",
      inputSchema: {
        brand: brandArg,
        moment_id: z.string().optional().describe("From trigger_queue or recent_moments."),
        team: teamArg.optional().describe("With moment_type, builds a sample before there's a real moment."),
        moment_type: z.enum(MOMENT_TYPES).optional(),
        league: leagueArg,
        offer: z.string().max(140).optional().describe('An offer to feature, like "15% off with code BOLT15 through Monday".'),
        products: z.array(z.string()).max(6).optional().describe("Product handles or titles to feature instead of Walkoff's picks."),
        reach: reachArg,
        store_url: z.string().url().optional().describe("The store's address, when Walkoff doesn't have it."),
        currency: z.string().length(3).optional().describe("For prices, like USD or GBP. Default from the team's country."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const now = ctx.now();
        const [report, catalog, areas] = await Promise.all([latestReport(db, b.id), loadTaggedCatalog(db, b.id), loadAreaCounts(db, b.id)]);
        let moment: CampaignMoment;
        if (args.moment_id) {
          const row = await momentById(db, args.moment_id);
          if (!row) throw new ToolError("No moment with that id. Get ids from trigger_queue or recent_moments.");
          const t = teamFromFeedId(row.team_id);
          if (!t) throw new ToolError("Walkoff has no fan territory for that team, so it can't build an audience.");
          const games = await gamesById(db, row.game_id ? [row.game_id] : []);
          moment = {
            id: row.id,
            type: row.type,
            phase: row.phase,
            headline: row.headline,
            intensity: row.intensity,
            occurredAt: new Date(row.occurred_at),
            gameStart: gameStartOf(row, games),
            team: t,
          };
        } else if (args.team && args.moment_type) {
          const t = team(args.team, args.league, standoutTeams(report));
          const phase = PHASE_OF.get(args.moment_type) ?? "after";
          moment = {
            id: null,
            type: args.moment_type,
            phase,
            headline: `Sample: ${typeName(args.moment_type)}`,
            intensity: 0.9,
            occurredAt: now,
            gameStart: phase === "before" ? new Date(now.getTime() + 8 * HOUR) : null,
            team: t,
          };
        } else {
          throw new ToolError("Pass a moment_id (from trigger_queue or recent_moments), or a team and a moment_type for a sample.");
        }

        const t = moment.team;
        let picks: Pick[];
        if (args.products?.length) {
          const wanted = new Set(args.products.map((s) => s.trim().toLowerCase()));
          const chosen = catalog.filter((p) => wanted.has((p.handle ?? "").toLowerCase()) || wanted.has(p.title.toLowerCase()));
          if (!chosen.length) throw new ToolError("None of those products are in the catalog. Use handles or exact titles from match_products.");
          const matched = pickForTeam(chosen, t.league, t.team, chosen.length);
          const have = new Set(matched.map((p) => p.handle));
          picks = [...matched, ...chosen.filter((p) => !have.has(p.handle)).map(plainPick)];
        } else {
          picks = pickForTeam(catalog, t.league, t.team, 3);
        }
        const audience = teamAudience(t, {
          reach: args.reach,
          customersByArea: new Map(areas.map((a) => [`${a.country}:${a.area}`, a.customers])),
        });
        const campaign = buildCampaign({
          brand: { name: b.name, storeUrl: args.store_url ?? b.store_url, licensed: b.licensed },
          moment,
          picks,
          audience,
          options: { offer: args.offer, currency: args.currency?.toUpperCase(), now },
        });
        return {
          brand: b.name,
          licensed: b.licensed,
          moment: { id: moment.id, type: moment.type, type_name: typeName(moment.type), headline: moment.headline, team: t.team.name, occurred_at: moment.occurredAt.toISOString() },
          ...campaign,
        };
      }),
  );

  server.registerTool(
    "trigger_queue",
    {
      title: "What to act on now",
      description:
        "The brand's to-do list: recent moments that match its triggers (or, with none set, big moments for its standout teams) that it hasn't drafted, sent or skipped yet, most urgent first, with how long each is worth acting on. Pass a moment's id to build_campaign.",
      inputSchema: {
        brand: brandArg,
        hours: z.number().int().min(1).max(336).optional().describe("How far back to look. Default 72."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const now = ctx.now();
        const [report, triggers] = await Promise.all([latestReport(db, b.id), listTriggers(db, b.id)]);
        const standouts = standoutTeams(report).map((t) => t.key);
        const active = triggers.filter((t) => t.active);
        const rules: TriggerRule[] = active.length ? active : [DEFAULT_RULE];
        const keys = new Set([...standouts, ...rules.flatMap((r) => r.team_keys)]);
        const teamIds = [...keys].map((k) => teamByKey(k)).filter((t): t is TeamRef => !!t).map(feedIdOf);
        const rows = await recentMoments(db, { teamIds, since: new Date(now.getTime() - (args.hours ?? 72) * HOUR), limit: 300 });
        const [{ names, games }, sends] = await Promise.all([momentContext(ctx, rows), sendsFor(db, b.id, { momentIds: rows.map((r) => r.id) })]);
        const acted = latestByMoment(sends);
        const rank = { closing: 0, open: 1, closed: 2 } as const;
        const queue = rows
          .filter((r) => !acted.has(r.id))
          .map((r) => {
            const qm = { type: r.type, intensity: r.intensity, occurredAt: new Date(r.occurred_at), gameStart: gameStartOf(r, games), teamKey: teamFromFeedId(r.team_id)?.key ?? null };
            return { r, rule: matchingRule(qm, rules, standouts), window: momentWindow(qm, now) };
          })
          .filter((x) => x.rule && x.window.status !== "closed")
          .sort((a, b) => rank[a.window.status] - rank[b.window.status] || b.r.intensity - a.r.intensity || b.r.occurred_at.localeCompare(a.r.occurred_at))
          .slice(0, 25);
        return {
          brand: b.name,
          rules: rules.map(triggerView),
          ...(active.length ? {} : { note: "No triggers set, so this uses Walkoff's default. create_trigger makes your own." }),
          queue: queue.map((x) => ({
            ...momentView(x.r, names, x.r.game_id ? games.get(x.r.game_id) : undefined),
            matched: x.rule!.name,
            trigger_id: x.rule!.id === DEFAULT_RULE.id ? null : x.rule!.id,
            window: x.window,
          })),
          handled_in_window: acted.size,
          next: queue.length ? "build_campaign with a moment_id, or log_send with status skipped to clear one." : "Nothing to act on right now.",
        };
      }),
  );

  server.registerTool(
    "create_trigger",
    {
      title: "Create a trigger",
      description:
        "Saves a rule for the moments a brand wants to act on, like walk-off and comeback wins for its standout teams, or every rivalry game for one team. trigger_queue then lists matching moments. With no teams it follows the brand's standout territories as they change.",
      inputSchema: {
        brand: brandArg,
        name: z.string().min(1).max(80).describe('What to call it, like "Big wins in our top markets".'),
        moment_types: z.array(z.enum(MOMENT_TYPES)).optional().describe("Moment types to act on. Empty: any."),
        teams: z.array(z.string()).max(30).optional().describe("Teams by name or key. Empty: the brand's standout teams."),
        league: leagueArg,
        min_intensity: z.number().min(0).max(1).optional().describe("Skip moments below this intensity (0 to 1). Walk-offs are about 0.9, close losses 0.5."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const standouts = standoutTeams(await latestReport(db, b.id));
        const keys = [...new Set((args.teams ?? []).map((q) => team(q, args.league, standouts).key))];
        const row = await createTrigger(db, b.id, {
          name: args.name.trim(),
          moment_types: args.moment_types ?? [],
          team_keys: keys,
          min_intensity: args.min_intensity ?? 0,
          created_by: principal.email,
        });
        return { brand: b.name, trigger: triggerView(row), next: "trigger_queue now includes moments that match." };
      }),
  );

  server.registerTool(
    "list_triggers",
    {
      title: "List triggers",
      description: "The brand's saved triggers. With none, trigger_queue uses Walkoff's default: big moments for the brand's standout teams.",
      inputSchema: { brand: brandArg },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const triggers = await listTriggers(db, b.id);
        return {
          brand: b.name,
          triggers: triggers.map((t) => ({ ...triggerView(t), created_by: t.created_by, created_at: t.created_at })),
          ...(triggers.length ? {} : { default_rule: triggerView(DEFAULT_RULE) }),
        };
      }),
  );

  server.registerTool(
    "delete_trigger",
    {
      title: "Delete a trigger",
      description: "Deletes one of the brand's triggers. The send log keeps its history.",
      inputSchema: { brand: brandArg, trigger_id: z.string().describe("From list_triggers.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        if (!(await deleteTrigger(db, b.id, args.trigger_id))) throw new ToolError(`${b.name} has no trigger with that id. list_triggers shows them.`);
        return { brand: b.name, deleted: args.trigger_id };
      }),
  );

  server.registerTool(
    "log_send",
    {
      title: "Log a send",
      description:
        "Records what the brand did with a moment: drafted (a Klaviyo draft exists), sent (scheduled or sent) or skipped. Keeps trigger_queue clean and builds the history Walkoff reports results from. Call it after drafting in Klaviyo, again once it's scheduled, or to skip a moment.",
      inputSchema: {
        brand: brandArg,
        moment_id: z.string(),
        status: z.enum(["drafted", "sent", "skipped"]),
        campaign_ref: z.string().max(300).optional().describe("The Klaviyo campaign id or link."),
        audience_size: z.number().int().min(0).optional(),
        notes: z.string().max(500).optional(),
        trigger_id: z.string().optional().describe("The trigger that surfaced it, from trigger_queue."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const moment = await momentById(db, args.moment_id);
        if (!moment) throw new ToolError("No moment with that id.");
        let triggerId: string | null = null;
        if (args.trigger_id) {
          const mine = await listTriggers(db, b.id);
          if (!mine.some((t) => t.id === args.trigger_id)) throw new ToolError(`${b.name} has no trigger with that id.`);
          triggerId = args.trigger_id;
        }
        const row = await logSend(db, {
          brand_id: b.id,
          moment_id: moment.id,
          trigger_id: triggerId,
          status: args.status,
          campaign_ref: args.campaign_ref ?? null,
          audience_size: args.audience_size ?? null,
          notes: args.notes ?? null,
          created_by: principal.email,
        });
        return {
          brand: b.name,
          logged: { id: row.id, status: row.status, moment: moment.headline, campaign_ref: row.campaign_ref, at: row.created_at },
          next: args.status === "drafted" ? "Once it's scheduled in Klaviyo, log it again as sent." : "It's off the queue.",
        };
      }),
  );

  server.registerTool(
    "send_history",
    {
      title: "Send history",
      description: "What the brand drafted, sent and skipped, newest first, with the moment behind each.",
      inputSchema: {
        brand: brandArg,
        days: z.number().int().min(1).max(365).optional().describe("How far back. Default 30."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      run(async () => {
        const b = await brandFor(db, principal, args.brand);
        const since = new Date(ctx.now().getTime() - (args.days ?? 30) * 24 * HOUR);
        const sends = await sendsFor(db, b.id, { since });
        const moments = await momentsByIds(db, sends.map((s) => s.moment_id));
        const names = await teamNames(db, [...moments.values()].map((m) => m.team_id));
        const totals = { drafted: 0, sent: 0, skipped: 0 };
        for (const s of latestByMoment(sends).values()) totals[s.status]++;
        return {
          brand: b.name,
          moments_by_latest_status: totals,
          sends: sends.map((s) => {
            const m = moments.get(s.moment_id);
            return {
              at: s.created_at,
              status: s.status,
              moment: m?.headline ?? null,
              type_name: m ? typeName(m.type) : null,
              team: m?.team_id ? (names.get(m.team_id) ?? m.team_id) : null,
              moment_id: s.moment_id,
              campaign_ref: s.campaign_ref,
              audience_size: s.audience_size,
              notes: s.notes,
              by: s.created_by,
            };
          }),
        };
      }),
  );
}
