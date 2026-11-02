// Pulls the stores to pitch from the Store Leads API into a CSV that
// `npm run prospects -- import` reads. Needs STORELEADS_API_KEY (Pro plan
// or higher). docs/storeleads.md has the plan, the search and the steps.
//
//   npm run storeleads -- count                        # how many stores the search matches
//   npm run storeleads -- pull [--out storeleads.csv] [--max 500] [--list <id>]
import "./lib/env";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { countMatches, keep, pullDomains, SEPARATOR, StoreLeadsError, toCsv } from "../lib/outreach/storeleads";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", default: "storeleads.csv" },
    max: { type: "string" },
    list: { type: "string" },
  },
});

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(`
  npm run storeleads -- count [--list <id>]
  npm run storeleads -- pull [--out storeleads.csv] [--max 500] [--list <id>]`);
  process.exit(1);
}

const fmt = (n: number) => n.toLocaleString("en-US");

async function main() {
  const [command] = positionals;
  if (command !== "count" && command !== "pull") usage();
  const key = process.env.STORELEADS_API_KEY?.trim();
  if (!key) {
    usage(
      "STORELEADS_API_KEY isn't set. Store Leads shows the key on its Account page, API tab (Pro plan or higher). " +
        "Add it as an environment secret named STORELEADS_API_KEY, or to .env.local, never to the repo.",
    );
  }
  const max = args.max === undefined ? undefined : Number(args.max);
  if (max !== undefined && (!Number.isInteger(max) || max < 1)) usage("--max takes a whole number.");
  const opts = { key, list: args.list };

  if (command === "count") {
    const total = await countMatches(opts);
    console.log(total === null ? "Store Leads didn't say how many." : `${fmt(total)} stores match${args.list ? ` list ${args.list}` : " the search"}.`);
    return;
  }

  const { domains, total } = await pullDomains({
    ...opts,
    max,
    onPage: (got, all) => console.log(`  ${fmt(got)}${all === null ? "" : ` of ${fmt(all)}`}`),
  });
  const kept = keep(domains);
  writeFileSync(args.out!, toCsv(kept.domains));
  console.log(`\nPulled ${fmt(domains.length)}${total === null ? "" : ` of ${fmt(total)}`} stores, wrote ${fmt(kept.domains.length)} to ${args.out}.`);
  for (const [reason, n] of Object.entries(kept.dropped)) console.log(`  left out ${fmt(n)}: ${reason}`);
  console.log(`\nNext: npm run prospects -- import ${args.out} --separator "${SEPARATOR}" --dry-run`);
}

main().catch((err) => {
  console.error(err instanceof StoreLeadsError || err instanceof Error ? err.message : err);
  process.exit(1);
});
