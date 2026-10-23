// Claude's pass over a brand's catalog. It reads products the way fans do
// (nicknames, chants, stadiums, team colors) and returns the same
// ProductTags as the keyword rules, with a reason for every team.
// Products go 25 to a request; the instructions and team list are one
// cached system prompt. catalog-tagging.ts runs it over a brand's catalog,
// for the engine after each product upload and for scripts/tag-catalog.ts.
import Anthropic from "@anthropic-ai/sdk";
import { TEAM_HOMES } from "./geo";
import type { CatalogItem } from "./imports";
import { COLORS, INTERESTS, SEASONS, USES, type ProductTags, type TeamTag } from "./tagging";

export const DEFAULT_MODEL = "claude-opus-5-5";
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export type ProductInput = Pick<CatalogItem, "handle" | "title" | "productType" | "category" | "tags" | "description">;

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Reply {
  /** The reply's text after any fallback switch, still unparsed. */
  text: string;
  stopReason: string | null;
  model: string;
  usage: Usage;
}

/** Sends one batch prompt to Claude. Tests pass their own. */
export type Send = (prompt: string) => Promise<Reply>;

const PRO_LEAGUES = ["nfl", "nba", "nhl", "mlb", "epl"];
const COLLEGE_LEAGUES = ["ncaaf", "ncaab"];

interface Directory {
  text: string;
  keys: Map<string, TeamTag>;
}

let directory: Directory | null = null;

/** Every team Claude may tag, one line each, keyed like "nfl:21". */
export function teamDirectory(): Directory {
  if (directory) return directory;
  const keys = new Map<string, TeamTag>();
  const lines: string[] = [];
  for (const league of PRO_LEAGUES) {
    for (const t of TEAM_HOMES[league] ?? []) {
      const key = `${league}:${t.id}`;
      keys.set(key, { league, teamId: t.id, name: t.name });
      lines.push(`${key} ${t.abbr} ${t.name}`);
    }
  }
  // A school's football and basketball teams share an id: one line, both keys.
  const schools = new Map<string, { abbr: string; name: string; leagues: string[] }>();
  for (const league of COLLEGE_LEAGUES) {
    for (const t of TEAM_HOMES[league] ?? []) {
      const school = schools.get(t.id) ?? { abbr: t.abbr, name: t.name, leagues: [] };
      school.leagues.push(league);
      schools.set(t.id, school);
      keys.set(`${league}:${t.id}`, { league, teamId: t.id, name: t.name });
    }
  }
  for (const [id, s] of [...schools].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    lines.push(`${s.leagues.map((l) => `${l}:${id}`).join(" ")} ${s.abbr} ${s.name}`);
  }
  directory = { text: lines.join("\n"), keys };
  return directory;
}

const INSTRUCTIONS = `You tag products from an online store's catalog for Walkoff. Walkoff sends a brand's customers timely messages about things they care about: their team just won, a big swell is arriving, the first cold snap. Your tags decide which products those messages feature, so a wrong team tag shows fans the wrong product. When in doubt, leave a tag out.

Each product has a ref and a title, plus whatever else the store keeps: product type, category, the store's own tags and a description. Return one entry for every product, with its ref.

teams: the teams a product is made for. Tag a team when the product names it or refers to it in a way its fans would recognize at once, such as a nickname, mascot, stadium, chant or slogan ("Bird Gang", "Who Dey"), a player, or team colors described as that team's colors. Copy keys exactly from the team list below, and say in a few words what gave it away, quoting the product where you can. Don't tag a team for:
- a city, state or region on its own ("Philly Proud", "Texas Forever"). That's local pride, not a team.
- colors on their own ("Green and Gold Tumbler").
- a name several teams share, when nothing in the product settles which one ("Giants Mug").
- a generic sports product ("Football Koozie", "Game Day Tee").
A school has a football key when it plays top-division football and a basketball key. A product for the school in general gets all its keys; a product about one sport gets only that sport's key.

colors: the product's own colors, using the most specific allowed name the text supports ("midnight green" rather than "green"). A color that's only part of a team name isn't a product color ("Blue Devils", "Red Sox").

uses: cold_weather (hoodies, beanies, blankets), tailgate (koozies, drinkware, coolers, chairs), game_day (jerseys, tees, hats, flags), home (mugs, decor, signs), gift (gift sets, bundles, gift cards), kids, pets, summer (shorts, swim, sun).

seasons: when it sells best, only when the product makes that clear. Cold-weather gear is fall and winter, holiday items winter, swimwear summer. Leave it empty for year-round products.

interests: scenes the product is made for beyond team sports: surf, skate, snow (skiing and snowboarding), fishing, hunting, western (ranch, rodeo, cowboy), golf, motorsports (moto, racing), outdoors (camping, hiking, climbing), cycling, running, fitness, music. Tag one when the product is designed for it or speaks to people who are into it, not for a passing word.`;

export function systemPrompt(): string {
  return `${INSTRUCTIONS}

Team list. Each line has the team's key, then its abbreviation and name. NFL, NBA, NHL and MLB teams and Premier League clubs (epl) come first. Then colleges, with ncaaf for college football and ncaab for men's college basketball.

${teamDirectory().text}`;
}

const tagList = (values: readonly string[]) => ({ type: "array", items: { type: "string", enum: [...values] } });

/** Sent as is: the API enforces the enums. */
export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          teams: {
            type: "array",
            items: {
              type: "object",
              properties: { key: { type: "string" }, why: { type: "string" } },
              required: ["key", "why"],
              additionalProperties: false,
            },
          },
          colors: tagList(COLORS),
          uses: tagList(USES),
          seasons: tagList(SEASONS),
          interests: tagList(INTERESTS),
        },
        required: ["ref", "teams", "colors", "uses", "seasons", "interests"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
};

/** What Claude is asked to do: instructions and the JSON shape to answer in. */
export interface Task {
  system: string;
  schema: Record<string, unknown>;
}

export const productTask = (): Task => ({ system: systemPrompt(), schema: OUTPUT_SCHEMA });

/** The real Send: one Messages API call per batch. */
export function claudeSend(
  task: Task,
  options: { client?: Anthropic; model?: string; effort?: Effort } = {},
): Send {
  // The SDK retries rate limits, overloads and dropped connections with backoff.
  const client = options.client ?? new Anthropic({ maxRetries: 6 });
  const model = options.model ?? DEFAULT_MODEL;
  return async (prompt) => {
    const message = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // If Claude declines a batch, the API re-runs it on the recommended
      // fallback model instead of returning a refusal.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: options.effort ?? "medium", format: { type: "json_schema", schema: task.schema } },
      system: [{ type: "text", text: task.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });
    // Text before a fallback switch belongs to the model that declined.
    let text = "";
    for (const block of message.content) {
      if (block.type === "fallback") text = "";
      else if (block.type === "text") text += block.text;
    }
    return {
      text,
      stopReason: message.stop_reason,
      model: message.model,
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
        cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      },
    };
  };
}

export function batchPrompt(batch: ProductInput[]): string {
  const lines = batch.map((p, i) => {
    const product: Record<string, unknown> = { ref: `p${i + 1}`, title: p.title };
    if (p.productType) product.type = p.productType;
    if (p.category) product.category = p.category;
    if (p.tags.length) product.tags = p.tags;
    if (p.description) product.description = p.description;
    return JSON.stringify(product);
  });
  return `Tag these ${batch.length} products. Return one entry for every product, with its ref.\n\n${lines.join("\n")}`;
}

interface Entry {
  teams: { key: string; why: string }[];
  colors: string[];
  uses: string[];
  seasons: string[];
  interests: string[];
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Entries by ref. Anything malformed counts as missing. */
function readEntries(text: string): Map<string, Entry> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const products = (raw as { products?: unknown })?.products;
  if (!Array.isArray(products)) return null;
  const out = new Map<string, Entry>();
  for (const p of products) {
    if (!p || typeof p !== "object" || typeof p.ref !== "string") continue;
    const teams = Array.isArray(p.teams)
      ? p.teams.filter((t: unknown): t is { key: string; why: string } => {
          const x = t as { key?: unknown; why?: unknown };
          return typeof x?.key === "string" && typeof x?.why === "string";
        })
      : [];
    out.set(p.ref, {
      teams,
      colors: strings(p.colors),
      uses: strings(p.uses),
      seasons: strings(p.seasons),
      interests: strings(p.interests),
    });
  }
  return out;
}

function only(values: string[], allowed: readonly string[]): string[] {
  return [...new Set(values.filter((v) => allowed.includes(v)))];
}

function toTags(entry: Entry, unknownKeys: string[]): ProductTags {
  const keys = teamDirectory().keys;
  const teams: TeamTag[] = [];
  for (const t of entry.teams) {
    const team = keys.get(t.key.trim().toLowerCase());
    if (!team) {
      unknownKeys.push(t.key);
      continue;
    }
    if (teams.some((x) => x.league === team.league && x.teamId === team.teamId)) continue;
    teams.push({ ...team, why: t.why.trim().slice(0, 200) });
  }
  return {
    teams,
    colors: only(entry.colors, COLORS),
    uses: only(entry.uses, USES),
    seasons: only(entry.seasons, SEASONS),
    interests: only(entry.interests, INTERESTS),
  };
}

export interface TagRun {
  /** Claude's tags by product handle. */
  tags: Map<string, ProductTags>;
  /** Products Claude couldn't tag this run. They keep their rule tags. */
  failed: string[];
  /** Team keys Claude returned that aren't in the team list (dropped). */
  unknownKeys: string[];
  usage: Usage;
  requests: number;
  models: Set<string>;
}

export interface TagOptions {
  send: Send;
  batchSize?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  log?: (line: string) => void;
}

/** Errors no retry will fix: stop the run instead of failing every batch. */
function isFatal(err: unknown): boolean {
  return (
    err instanceof Anthropic.BadRequestError ||
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof Anthropic.NotFoundError
  );
}

export async function tagWithClaude(products: ProductInput[], options: TagOptions): Promise<TagRun> {
  const batchSize = options.batchSize ?? 25;
  const concurrency = options.concurrency ?? 4;
  const log = options.log ?? (() => {});
  const run: TagRun = {
    tags: new Map(),
    failed: [],
    unknownKeys: [],
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    requests: 0,
    models: new Set(),
  };
  let done = 0;
  const finish = (batch: ProductInput[]) => {
    done += batch.length;
    options.onProgress?.(done, products.length);
  };
  const fail = (batch: ProductInput[], why: string) => {
    log(`${batch.length} product${batch.length === 1 ? "" : "s"} not tagged: ${why}`);
    run.failed.push(...batch.map((p) => p.handle));
    finish(batch);
  };

  async function tagBatch(batch: ProductInput[], retryMissing: boolean): Promise<void> {
    let reply: Reply;
    try {
      reply = await options.send(batchPrompt(batch));
    } catch (err) {
      if (isFatal(err)) throw err;
      if (err instanceof Anthropic.APIError) return fail(batch, err.message);
      throw err;
    }
    run.requests++;
    run.models.add(reply.model);
    run.usage.input += reply.usage.input;
    run.usage.output += reply.usage.output;
    run.usage.cacheRead += reply.usage.cacheRead;
    run.usage.cacheWrite += reply.usage.cacheWrite;

    const entries = reply.stopReason === "refusal" ? null : readEntries(reply.text);
    if (!entries) {
      // Cut off, declined or unreadable: halve the batch, which also
      // isolates a product that trips a refusal.
      const why = reply.stopReason === "refusal" ? "declined" : reply.stopReason === "max_tokens" ? "reply cut off" : "unreadable reply";
      if (batch.length === 1) return fail(batch, why);
      const half = Math.ceil(batch.length / 2);
      await tagBatch(batch.slice(0, half), retryMissing);
      await tagBatch(batch.slice(half), retryMissing);
      return;
    }

    const missing: ProductInput[] = [];
    batch.forEach((p, i) => {
      const entry = entries.get(`p${i + 1}`);
      if (entry) run.tags.set(p.handle, toTags(entry, run.unknownKeys));
      else missing.push(p);
    });
    finish(batch.filter((p) => !missing.includes(p)));
    if (!missing.length) return;
    if (retryMissing) await tagBatch(missing, false);
    else fail(missing, "left out of the reply");
  }

  const batches: ProductInput[][] = [];
  for (let i = 0; i < products.length; i += batchSize) batches.push(products.slice(i, i + batchSize));
  if (!batches.length) return run;

  // The first request writes the prompt cache; the rest read it.
  await tagBatch(batches[0], true);
  let next = 1;
  const worker = async () => {
    while (next < batches.length) await tagBatch(batches[next++], true);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length - 1) }, worker));
  return run;
}

// ── Color names ────────────────────────────────────────────────────

export const colorTask = (): Task => ({
  system: `You name colors for an online store. Each line is a color name from the store's product variants, like "Azure Heather" or "Dune". For each, give the hex value of the color a shopper would expect to see. Names are often fanciful; go by what the word suggests in fashion. For a name with several colors ("Navy/Gold", "Black Camo"), give each main color, at most three. If a name isn't a color at all ("Solid", "Default", "Print"), give no hex. Return one entry for every name, with its ref.`,
  schema: {
    type: "object",
    properties: {
      colors: {
        type: "array",
        items: {
          type: "object",
          properties: { ref: { type: "string" }, hex: { type: "array", items: { type: "string" } } },
          required: ["ref", "hex"],
          additionalProperties: false,
        },
      },
    },
    required: ["colors"],
    additionalProperties: false,
  },
});

export interface ColorRun {
  /** Hex values by color name, as given. */
  colors: Map<string, string[]>;
  failed: string[];
  usage: Usage;
  requests: number;
}

/** Hex values for color names the rules can't read ("Cove", "Fog"). */
export async function nameColorsWithClaude(
  names: string[],
  options: { send: Send; batchSize?: number; log?: (line: string) => void },
): Promise<ColorRun> {
  const batchSize = options.batchSize ?? 120;
  const run: ColorRun = { colors: new Map(), failed: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, requests: 0 };
  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const prompt = `Name these ${batch.length} colors.\n\n${batch.map((n, j) => `c${j + 1}: ${n}`).join("\n")}`;
    let reply: Reply;
    try {
      reply = await options.send(prompt);
    } catch (err) {
      if (isFatal(err)) throw err;
      if (!(err instanceof Anthropic.APIError)) throw err;
      options.log?.(`${batch.length} color names not named: ${err.message}`);
      run.failed.push(...batch);
      continue;
    }
    run.requests++;
    for (const k of ["input", "output", "cacheRead", "cacheWrite"] as const) run.usage[k] += reply.usage[k];
    let entries: { ref?: unknown; hex?: unknown }[] = [];
    try {
      const parsed = JSON.parse(reply.text) as { colors?: unknown };
      if (Array.isArray(parsed.colors)) entries = parsed.colors;
    } catch {
      // Unreadable: every name in the batch falls through to failed below.
    }
    const byRef = new Map(entries.map((e) => [e.ref, e.hex]));
    batch.forEach((name, j) => {
      const hex = byRef.get(`c${j + 1}`);
      if (!Array.isArray(hex)) return run.failed.push(name);
      const clean = hex
        .filter((h): h is string => typeof h === "string" && /^#?[0-9a-f]{6}$/i.test(h.trim()))
        .map((h) => h.trim().replace(/^#/, "").toLowerCase())
        .slice(0, 3);
      run.colors.set(name, clean);
    });
  }
  return run;
}

/** Dollars per million tokens for the default model, for the run summary. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  [DEFAULT_MODEL]: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

export function estimateCost(model: string, usage: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite) / 1e6;
}
