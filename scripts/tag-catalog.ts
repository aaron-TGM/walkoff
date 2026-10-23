// Tags a catalog with Claude: a brand's saved products, or a product export
// on disk.
//
//   npm run affinity:tag -- --brand <brand id or upload token>
//   npm run affinity:tag -- --file products.csv [--out tags.json]
//
// Claude tags each product (teams, colors, uses, seasons, interests) and
// names the brand's colorways ("Dune" looks like this hex). --brand saves
// both and refreshes the brand's report (add --dry-run to only look).
// --file prints what Claude found and saves nothing. Needs
// ANTHROPIC_API_KEY, or a profile from `ant auth login`.
//
// The engine already does this for each brand a minute or so after a
// product upload (engine/tagger.ts). This is for a look first, redoing
// everything (--all) or trying a file.
import "./lib/env";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import Papa from "papaparse";
import { pendingWork, runCatalogPass } from "../lib/affinity/catalog-tagging";
import {
  claudeSend,
  colorTask,
  DEFAULT_MODEL,
  EFFORTS,
  estimateCost,
  productTask,
  type ColorRun,
  type Effort,
  type ProductInput,
  type TagRun,
  type Usage,
} from "../lib/affinity/claude-tagger";
import { colorFamily, hexForColorName } from "../lib/affinity/colors";
import { TEAM_HOMES } from "../lib/affinity/geo";
import { detectFormat, formatKind, parseCatalog, type Colorway, type Row } from "../lib/affinity/imports";
import { findBrand } from "../lib/affinity/store";
import { tagProduct, type TeamTag } from "../lib/affinity/tagging";
import { scriptDb } from "./lib/db";

const { values: args } = parseArgs({
  options: {
    brand: { type: "string" },
    file: { type: "string" },
    out: { type: "string" },
    all: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    model: { type: "string", default: process.env.WALKOFF_TAG_MODEL || DEFAULT_MODEL },
    effort: { type: "string", default: process.env.WALKOFF_TAG_EFFORT || "medium" },
    "batch-size": { type: "string", default: "25" },
    concurrency: { type: "string", default: "4" },
  },
});

function usage(message: string): never {
  console.error(`${message}

  npm run affinity:tag -- --brand <brand id or upload token> [--all] [--dry-run] [--limit N]
  npm run affinity:tag -- --file products.csv [--out tags.json] [--limit N]

  --all          re-tag products and colors Claude already tagged
  --model        default ${DEFAULT_MODEL} (or WALKOFF_TAG_MODEL)
  --effort       ${EFFORTS.join(", ")}; default medium (or WALKOFF_TAG_EFFORT)`);
  process.exit(1);
}

const abbr = new Map(Object.entries(TEAM_HOMES).flatMap(([league, teams]) => teams.map((t) => [`${league}:${t.id}`, t.abbr])));
const teamKey = (t: TeamTag) => `${t.league}:${t.teamId}`;
const label = (t: TeamTag) => `${abbr.get(teamKey(t)) ?? t.name} (${t.league})`;

function readCatalogFile(path: string): (ProductInput & { colorways: Colorway[] })[] {
  const parsed = Papa.parse<Row>(readFileSync(path, "utf8"), { header: true, skipEmptyLines: "greedy" });
  const format = detectFormat(parsed.meta.fields ?? []);
  if (!format || formatKind(format) !== "catalog") usage(`${path} doesn't look like a product export.`);
  return parseCatalog(format, parsed.data);
}

/** What Claude changed versus the keyword rules, one line per product. */
function printChanges(products: ProductInput[], run: TagRun) {
  let changed = 0;
  for (const p of products) {
    const claude = run.tags.get(p.handle);
    if (!claude) continue;
    const rules = tagProduct(p).teams;
    const ruleKeys = new Set(rules.map(teamKey));
    const claudeKeys = new Set(claude.teams.map(teamKey));
    const added = claude.teams.filter((t) => !ruleKeys.has(teamKey(t)));
    const removed = rules.filter((t) => !claudeKeys.has(teamKey(t)));
    if (!added.length && !removed.length && !claude.interests.length) continue;
    changed++;
    const parts = [
      ...added.map((t) => `+${label(t)}: ${t.why ?? ""}`),
      ...removed.map((t) => `-${label(t)}`),
      ...(claude.interests.length ? [`interests: ${claude.interests.join(", ")}`] : []),
    ];
    console.log(`  ${p.title}\n    ${parts.join("\n    ")}`);
  }
  if (!changed) console.log("  Claude agreed with the keyword rules on every product.");
}

/** Color names the rules couldn't read, and what Claude made of them. */
function printColors(names: string[], run: ColorRun) {
  const fanciful = names.filter((n) => !hexForColorName(n).length && run.colors.has(n));
  if (!fanciful.length) return;
  console.log("\nColor names only Claude could read:");
  for (const n of fanciful.slice(0, 15)) {
    const hex = run.colors.get(n)!;
    console.log(`  ${n}: ${hex.length ? hex.map((h) => `#${h} (${colorFamily(h)})`).join(", ") : "not a color"}`);
  }
  if (fanciful.length > 15) console.log(`  …and ${fanciful.length - 15} more.`);
}

function printSummary(products: ProductInput[], run: TagRun | null, colors: ColorRun | null, model: string) {
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const r of [run, colors]) for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += r?.usage[k] ?? 0;
  const requests = (run?.requests ?? 0) + (colors?.requests ?? 0);
  const prompt = usage.input + usage.cacheRead + usage.cacheWrite;
  const cost = estimateCost(model, usage);
  const lines = [""];
  if (run) {
    const withTeams = [...run.tags.values()].filter((t) => t.teams.length).length;
    const withInterests = [...run.tags.values()].filter((t) => t.interests.length).length;
    lines.push(`Tagged ${run.tags.size} of ${products.length} products: ${withTeams} to a team, ${withInterests} to an interest.`);
    if (run.failed.length) lines.push(`Not tagged this run (they keep their rule tags): ${run.failed.length}.`);
    if (run.unknownKeys.length) lines.push(`Dropped team keys that aren't ours: ${[...new Set(run.unknownKeys)].join(", ")}.`);
  }
  if (colors) {
    lines.push(`Named ${colors.colors.size} colors.` + (colors.failed.length ? ` ${colors.failed.length} kept the rules' reading.` : ""));
  }
  lines.push(
    `${requests} request${requests === 1 ? "" : "s"} to ${[...(run?.models ?? [])].join(", ") || model}, ${prompt.toLocaleString()} prompt tokens` +
      ` (${prompt ? Math.round((usage.cacheRead / prompt) * 100) : 0}% from cache), ${usage.output.toLocaleString()} output tokens` +
      (cost === null ? "." : `, about $${cost.toFixed(2)}.`),
  );
  console.log(lines.join("\n"));
}

const distinct = (names: string[]) => [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];

async function main() {
  if (!args.brand === !args.file) usage("Pass --brand or --file.");
  const effort = args.effort as Effort;
  if (!EFFORTS.includes(effort)) usage(`--effort must be one of ${EFFORTS.join(", ")}.`);
  const limit = args.limit ? Number(args.limit) : Infinity;

  const db = args.brand ? scriptDb() : null;
  const brand = db && args.brand ? await findBrand(db, args.brand) : null;
  if (db && !brand) usage(`No brand with id or upload token ${args.brand}.`);

  let products: (ProductInput & { colorways: Colorway[] })[];
  let colorNames: string[];
  if (db && brand) {
    const work = await pendingWork(db, brand, { all: args.all });
    if (!work.total) usage(`${brand.name} has no products yet. They upload them in step 2 of their upload page.`);
    ({ products, colorNames } = work);
    console.log(
      `${brand.name}: ${work.total} products, ${products.length} to tag, ${colorNames.length} color names to read` +
        (args.all ? "." : " (--all redoes what Claude already did)."),
    );
  } else {
    products = readCatalogFile(args.file!);
    colorNames = distinct(products.flatMap((p) => p.colorways.map((c) => c.name)));
    console.log(`${args.file}: ${products.length} products, ${colorNames.length} color names.`);
  }
  products = products.slice(0, limit);
  if (!products.length && !colorNames.length) return console.log("Nothing to tag.");

  // Saves a slice at a time as it goes, unless this is a dry run or a file.
  const claude = { model: args.model, effort };
  const saveTo = db && brand && !args["dry-run"] ? { db, brand } : undefined;
  const pass = await runCatalogPass(
    { products, colorNames },
    {
      send: { products: claudeSend(productTask(), claude), colors: claudeSend(colorTask(), claude) },
      saveTo,
      batchSize: Number(args["batch-size"]),
      concurrency: Number(args.concurrency),
      onProgress: (done, total) => process.stderr.write(`\r  ${done}/${total} products`),
      log: (line) => process.stderr.write(`\n  ${line}\n`),
    },
  );
  const { run, colors } = pass;
  if (run) {
    process.stderr.write("\n");
    console.log("\nWhat Claude changed from the keyword rules:");
    printChanges(products, run);
  }
  if (colors) printColors(colorNames, colors);
  printSummary(products, run, colors, args.model!);

  const hexFor = (name: string) => colors?.colors.get(name) ?? hexForColorName(name);
  if (args.out) {
    const out = products.map((p) => ({
      handle: p.handle,
      title: p.title,
      ...(run?.tags.get(p.handle) ?? tagProduct(p)),
      colorways: p.colorways.map((c) => ({ ...c, hex: hexFor(c.name) })),
    }));
    writeFileSync(args.out, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`Wrote ${out.length} products to ${args.out}.`);
  }

  if (!db || !brand) return;
  if (!saveTo) return console.log("Dry run: nothing saved.");
  const named = colors?.colors.size ?? 0;
  const report = pass.report
    ? ` Report refreshed: ${pass.report.standouts.length} standout territories.`
    : pass.saved || named
      ? " No report yet: the brand hasn't uploaded customers."
      : "";
  console.log(`Saved ${pass.saved} products and ${named} color names.${report}`);
}

main().catch((err) => {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error(`\nClaude rejected the credentials (${err.status}). Set ANTHROPIC_API_KEY in .env.local, or run \`ant auth login\`.`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`\nThe Claude API stopped the run (${err.status ?? "no response"}): ${err.message}`);
  } else if (err instanceof Anthropic.AnthropicError) {
    console.error(`\n${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
