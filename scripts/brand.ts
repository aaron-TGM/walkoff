// Brands for the done-for-you onboarding.
//
//   npm run brand -- create "Sample Co" [--email owner@sample.co] [--store https://sample.co] [--licensed]
//   npm run brand -- list
//   npm run brand -- report <brand> [--refresh] [--json]
//   npm run brand -- set <brand> [--store https://sample.co] [--licensed | --unlicensed]
//   npm run brand -- invite <brand> person@sample.co
//   npm run brand -- members <brand> [--remove person@sample.co]
//
// <brand> is a brand's name, id or upload token. create prints the brand's
// private upload link. report prints its latest affinity map; --refresh
// recomputes it. invite lets someone connect Walkoff in Claude for the brand
// (they sign in with a code emailed to that address). --licensed lets
// campaigns name the brand's teams; without it they nod, not name.
import "./lib/env";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import type { AffinityReport, TeamGroup } from "../lib/affinity/compute";
import { findBrand, latestReport, recomputeReport, type Brand } from "../lib/affinity/store";
import { scriptDb, uploadLink } from "./lib/db";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    store: { type: "string" },
    licensed: { type: "boolean" },
    unlicensed: { type: "boolean" },
    remove: { type: "string" },
    refresh: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(`
  npm run brand -- create "Brand name" [--email owner@brand.com] [--store https://brand.com] [--licensed]
  npm run brand -- list
  npm run brand -- report <brand> [--refresh] [--json]
  npm run brand -- set <brand> [--store https://brand.com] [--licensed | --unlicensed]
  npm run brand -- invite <brand> person@brand.com
  npm run brand -- members <brand> [--remove person@brand.com]

  <brand> is a brand's name, id or upload token.`);
  process.exit(1);
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function storeUrl(raw: string): string {
  const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:") usage("--store must be an https address.");
  return url.origin;
}

function email(raw: string | undefined): string {
  const e = (raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) usage(`${raw ?? "That"} isn't an email address.`);
  return e;
}

/** A brand by id, upload token or name. */
async function brandArg(db: ReturnType<typeof scriptDb>, ref: string | undefined): Promise<Brand> {
  if (!ref) usage("Which brand? Pass its name, id or upload token.");
  const byKey = await findBrand(db, ref).catch(() => null);
  if (byKey) return byKey;
  const { data, error } = await db.from("brands").select("id, name").ilike("name", ref);
  if (error) throw error;
  if (data.length === 1) return { id: data[0].id as string, name: data[0].name as string };
  usage(data.length ? `More than one brand is named ${ref}; use its id.` : `No brand named ${ref}.`);
}

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
  for (const g of report.standouts) {
    console.log(line(g));
    for (const p of g.picks ?? []) {
      console.log(`         on a win: ${p.title}${p.colorway ? ` in ${p.colorway}` : ""} (${p.why.toLowerCase()})`);
    }
  }
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
      .insert({
        name,
        upload_token: token,
        contact_email: args.email ?? null,
        store_url: args.store ? storeUrl(args.store) : null,
        licensed: args.licensed ?? false,
      })
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

  if (command === "set") {
    const brand = await brandArg(db, rest.join(" ").trim());
    const changes: Record<string, unknown> = {};
    if (args.store) changes.store_url = storeUrl(args.store);
    if (args.licensed) changes.licensed = true;
    if (args.unlicensed) changes.licensed = false;
    if (!Object.keys(changes).length) usage("Nothing to change: pass --store, --licensed or --unlicensed.");
    const { data, error } = await db.from("brands").update(changes).eq("id", brand.id).select("store_url, licensed").single();
    if (error) throw error;
    console.log(`${brand.name}: store ${data.store_url ?? "not set"}, ${data.licensed ? "licensed (campaigns may name teams)" : "not licensed (campaigns nod, never name)"}.`);
    return;
  }

  if (command === "invite") {
    const who = email(rest.pop());
    const brand = await brandArg(db, rest.join(" ").trim());
    const { error } = await db.from("brand_members").upsert({ brand_id: brand.id, email: who }, { onConflict: "brand_id,email" });
    if (error) throw error;
    console.log(`${who} can now connect Walkoff for ${brand.name}.`);
    console.log("In Claude: Settings → Connectors → Add custom connector → https://www.walkoff.io/mcp, then sign in with this email.");
    return;
  }

  if (command === "members") {
    const brand = await brandArg(db, rest.join(" ").trim());
    if (args.remove) {
      const { error } = await db.from("brand_members").delete().eq("brand_id", brand.id).eq("email", email(args.remove));
      if (error) throw error;
      console.log(`Removed ${args.remove.toLowerCase()} from ${brand.name}.`);
    }
    const { data, error } = await db.from("brand_members").select("email, created_at").eq("brand_id", brand.id).order("created_at");
    if (error) throw error;
    console.log(data.length ? `${brand.name} members:\n${data.map((m) => `  ${m.email}`).join("\n")}` : `${brand.name} has no members yet.`);
    return;
  }

  if (command === "report") {
    const brand = await brandArg(db, rest.join(" ").trim());
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
