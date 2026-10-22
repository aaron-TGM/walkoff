// Brands for the done-for-you onboarding.
//
//   npm run brand -- create "Sample Co" [--email owner@sample.co]
//   npm run brand -- list
//   npm run brand -- report <brand id or upload token> [--refresh] [--json]
//
// create prints the brand's private upload link. report prints its latest
// affinity map; --refresh recomputes it from what the brand uploaded.
import "./lib/env";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import type { AffinityReport, TeamGroup } from "../lib/affinity/compute";
import { findBrand, latestReport, recomputeReport } from "../lib/affinity/store";
import { scriptDb, uploadLink } from "./lib/db";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    refresh: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(`
  npm run brand -- create "Brand name" [--email owner@brand.com]
  npm run brand -- list
  npm run brand -- report <brand id or upload token> [--refresh] [--json]`);
  process.exit(1);
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function printReport(name: string, report: AffinityReport) {
  const { totals } = report;
  console.log(`${name}, computed ${report.computedAt}`);
  console.log(
    `${fmt(totals.matchedCustomers)} customers in ${fmt(totals.areas)} postal areas` +
      (totals.unmatchedCustomers ? `, ${fmt(totals.unmatchedCustomers)} not placed` : "") +
      (totals.productOrders ? `, ${fmt(totals.productOrders)} product orders` : "") +
      ".",
  );
  const line = (g: TeamGroup) => {
    const buys = g.products[0] ? `  buys ${g.products[0].product} ${g.products[0].lift}x` : "";
    return `  ${`${g.lift}x`.padEnd(6)} ${g.teamName} (${g.leagueName}), ${fmt(g.customers)} customers${buys}`;
  };
  console.log(report.standouts.length ? "\nStandout territories:" : "\nNo territory stands out yet.");
  report.standouts.forEach((g) => console.log(line(g)));
  for (const league of report.leagues) {
    console.log(`\n${league.leagueName}, ${fmt(league.customers)} customers:`);
    league.teams.forEach((g) => console.log(line(g)));
  }
}

async function main() {
  const [command, ...rest] = positionals;
  const db = scriptDb();

  if (command === "create") {
    const name = rest.join(" ").trim();
    if (!name) usage("Give the brand a name.");
    const token = randomBytes(18).toString("base64url");
    const { data, error } = await db
      .from("brands")
      .insert({ name, upload_token: token, contact_email: args.email ?? null })
      .select("id")
      .single();
    if (error) throw error;
    console.log(`Created ${name}.\n  id:          ${data.id}\n  upload link: ${uploadLink(token)}`);
    console.log("Send the link only to the brand: anyone with it can upload to this brand.");
    return;
  }

  if (command === "list") {
    const { data, error } = await db.from("brands").select("id, name, upload_token, created_at").order("created_at");
    if (error) throw error;
    if (!data.length) return console.log('No brands yet. Create one with: npm run brand -- create "Brand name"');
    for (const b of data) console.log(`${b.name}\n  id: ${b.id}\n  ${uploadLink(b.upload_token)}`);
    return;
  }

  if (command === "report") {
    if (!rest[0]) usage("Which brand? Pass its id or upload token.");
    const brand = await findBrand(db, rest[0]);
    if (!brand) usage(`No brand with id or upload token ${rest[0]}.`);
    const report = args.refresh ? await recomputeReport(db, brand) : ((await latestReport(db, brand.id)) ?? (await recomputeReport(db, brand)));
    if (!report) return console.log(`${brand.name} hasn't uploaded customers yet.`);
    if (args.json) return console.log(JSON.stringify(report, null, 2));
    printReport(brand.name, report);
    return;
  }

  usage(command ? `Unknown command ${command}.` : undefined);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
