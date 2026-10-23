// Brands for the done-for-you onboarding. Walkoff operators can do the same
// in Claude (create_brand, invite_member and the rest, docs/mcp.md); both
// use lib/brands.ts.
//
//   npm run brand -- create "Sample Co" [--email owner@sample.co] [--store sample.co] [--licensed] [--allow-duplicate]
//   npm run brand -- list
//   npm run brand -- report <brand> [--refresh] [--json]
//   npm run brand -- set <brand> [--name "New name"] [--store sample.co] [--licensed | --unlicensed] [--new-upload-link]
//   npm run brand -- invite <brand> person@sample.co [--by you@walkoff.io] [--no-welcome]
//   npm run brand -- members <brand> [--remove person@sample.co]
//
// <brand> is a brand's name, id or upload token. create prints the brand's
// private upload link. report prints its latest affinity map; --refresh
// recomputes it. invite lets someone connect Walkoff in Claude for the brand
// (they sign in with a code emailed to that address) and emails them a
// welcome with the upload link and how to connect; --by says who invited
// them, --no-welcome skips the email. --licensed lets campaigns name the
// brand's teams; without it they nod, not name. --new-upload-link replaces
// the link, say after removing someone; invite sends the new one.
import "./lib/env";
import { parseArgs } from "node:util";
import type { AffinityReport, TeamGroup } from "../lib/affinity/compute";
import { latestReport, recomputeReport } from "../lib/affinity/store";
import {
  addMember,
  BrandError,
  createBrand,
  DuplicateBrand,
  listBrands,
  listMembers,
  normalizeEmail,
  removeMember,
  resolveBrand,
  siteOrigin,
  updateBrand,
  uploadLink,
  welcomeFor,
  type BrandChanges,
} from "../lib/brands";
import { resourceOf } from "../lib/mcp/oauth/config";
import { sendWelcome } from "../lib/welcome";
import { scriptDb } from "./lib/db";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    store: { type: "string" },
    name: { type: "string" },
    licensed: { type: "boolean" },
    unlicensed: { type: "boolean" },
    "allow-duplicate": { type: "boolean", default: false },
    by: { type: "string" },
    "no-welcome": { type: "boolean", default: false },
    "new-upload-link": { type: "boolean", default: false },
    remove: { type: "string" },
    refresh: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(`
  npm run brand -- create "Brand name" [--email owner@brand.com] [--store brand.com] [--licensed] [--allow-duplicate]
  npm run brand -- list
  npm run brand -- report <brand> [--refresh] [--json]
  npm run brand -- set <brand> [--name "New name"] [--store brand.com] [--licensed | --unlicensed] [--new-upload-link]
  npm run brand -- invite <brand> person@brand.com [--by you@walkoff.io] [--no-welcome]
  npm run brand -- members <brand> [--remove person@brand.com]

  <brand> is a brand's name, id or upload token.`);
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
    const brand = await createBrand(db, {
      name: rest.join(" "),
      storeUrl: args.store,
      licensed: args.licensed,
      contactEmail: args.email,
      allowDuplicate: args["allow-duplicate"],
    });
    console.log(`Created ${brand.name}.\n  id:          ${brand.id}\n  upload link: ${uploadLink(brand.upload_token)}`);
    console.log("Send the link only to the brand: anyone with it can upload to this brand. invite emails it to the people you add.");
    return;
  }

  if (command === "list") {
    const brands = await listBrands(db);
    if (!brands.length) return console.log('No brands yet. Create one with: npm run brand -- create "Brand name"');
    for (const b of brands) console.log(`${b.name}\n  id: ${b.id}\n  ${uploadLink(b.upload_token)}`);
    return;
  }

  if (command === "set") {
    const brand = await resolveBrand(db, rest.join(" "));
    const changes: BrandChanges = {};
    if (args.name !== undefined) changes.name = args.name;
    if (args.store) changes.storeUrl = args.store;
    if (args.licensed) changes.licensed = true;
    if (args.unlicensed) changes.licensed = false;
    if (args["new-upload-link"]) changes.newUploadLink = true;
    if (!Object.keys(changes).length) usage("Nothing to change: pass --name, --store, --licensed, --unlicensed or --new-upload-link.");
    const b = await updateBrand(db, brand.id, changes);
    console.log(`${b.name}: store ${b.store_url ?? "not set"}, ${b.licensed ? "licensed (campaigns may name teams)" : "not licensed (campaigns nod, never name)"}.`);
    if (changes.newUploadLink) {
      console.log(`New upload link: ${uploadLink(b.upload_token)}\nThe old one no longer works. invite sends the new one to each person who should still upload.`);
    }
    return;
  }

  if (command === "invite") {
    const who = rest.pop() ?? "";
    const brand = await resolveBrand(db, rest.join(" "));
    const invitedBy = args.by ? normalizeEmail(args.by) : null;
    const { email, added } = await addMember(db, brand.id, who);
    console.log(added ? `${email} can now connect Walkoff for ${brand.name}.` : `${email} could already connect Walkoff for ${brand.name}.`);
    if (args["no-welcome"]) {
      console.log(`In Claude: Customize → Connectors → Add custom connector → ${resourceOf(siteOrigin())}, then sign in with this email.`);
      return;
    }
    try {
      const sent = await sendWelcome(await welcomeFor(db, brand, email, { invitedBy }));
      console.log(
        sent === "sent"
          ? "Emailed them a welcome with the upload link and how to connect Walkoff in Claude."
          : "RESEND_API_KEY isn't set, so the welcome email is printed above instead.",
      );
    } catch (err) {
      console.error(`The welcome email didn't send (${err instanceof Error ? err.message : err}). Run invite again to retry.`);
      process.exit(1);
    }
    return;
  }

  if (command === "members") {
    const brand = await resolveBrand(db, rest.join(" "));
    if (args.remove) {
      const { email, removed } = await removeMember(db, brand.id, args.remove);
      console.log(
        removed
          ? `Removed ${email} from ${brand.name}. If they have the upload link, it still works: set --new-upload-link replaces it.`
          : `${email} wasn't a member of ${brand.name}.`,
      );
    }
    const members = await listMembers(db, brand.id);
    const state = (m: (typeof members)[number]) => (m.connected ? "connected" : m.needs_reconnect ? "needs to reconnect" : "not connected yet");
    console.log(
      members.length
        ? `${brand.name} members:\n${members.map((m) => `  ${m.email}  ${state(m)}`).join("\n")}`
        : `${brand.name} has no members yet.`,
    );
    return;
  }

  if (command === "report") {
    const brand = await resolveBrand(db, rest.join(" "));
    const report = args.refresh ? await recomputeReport(db, brand) : ((await latestReport(db, brand.id)) ?? (await recomputeReport(db, brand)));
    if (!report) return console.log(`${brand.name} hasn't uploaded customers yet.`);
    if (args.json) return console.log(JSON.stringify(report, null, 2));
    printReport(brand.name, report);
    return;
  }

  usage(command ? `Unknown command ${command}.` : undefined);
}

main().catch((err) => {
  if (err instanceof DuplicateBrand) usage(`${err.message} Pass --allow-duplicate to create another anyway.`);
  if (err instanceof BrandError) usage(err.message);
  console.error(err);
  process.exit(1);
});
