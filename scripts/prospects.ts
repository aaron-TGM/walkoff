// Walkoff's own outreach: find stores, score their catalogs against their
// home teams, and pitch the good ones with a sample built from their own
// products. See docs/outreach.md.
//
//   npm run prospects -- import storeleads.csv [--separator "|"] [--column region="HQ State"] [--dry-run]
//   npm run prospects -- score [--limit 50] [--rescore] [--only frostbuddy.com]
//   npm run prospects -- list [--status qualified] [--limit 30]
//   npm run prospects -- show frostbuddy.com
//   npm run prospects -- contacts apollo.csv [--source apollo] [--dry-run]
//   npm run prospects -- pitch frostbuddy.com [--team Chargers] [--moment <id> | --sample] [--to sam@frostbuddy.com]
//   npm run prospects -- mark <pitch link> sent|replied|bounced|unsubscribed
//   npm run prospects -- status frostbuddy.com trial [--note "Starts Monday"]
//   npm run prospects -- block sam@frostbuddy.com|frostbuddy.com [--reason "Asked"]
import "./lib/env";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { siteOrigin } from "../lib/brands";
import { momentById, recentMoments, typeName } from "../lib/mcp/data";
import type { CampaignMoment } from "../lib/mcp/campaign";
import { feedIdOf, resolveTeam, teamByKey, type TeamRef } from "../lib/mcp/teams";
import { contactDomain, domainOf, messagingApps, parseContacts, parseProspects, readCsv, type ProspectField, type ReadReport } from "../lib/outreach/csv";
import { homeTeams, locate, teamKeys } from "../lib/outreach/home";
import { buildPitch, momentFromRow, PITCH_MOMENTS, possessive, sampleMoment } from "../lib/outreach/pitch";
import { scoreProspect } from "../lib/outreach/score";
import {
  addContacts,
  addDoNotContact,
  blockedBy,
  contactsFor,
  createOutreach,
  listProspects,
  newPitchToken,
  OUTREACH_STATUSES,
  outreachByToken,
  outreachFor,
  prospectByDomain,
  PROSPECT_STATUSES,
  prospectsToScore,
  saveScore,
  setOutreachStatus,
  setProspectStatus,
  tokenOf,
  upsertProspects,
  type NewProspect,
  type OutreachStatus,
  type Prospect,
  type ProspectStatus,
} from "../lib/outreach/store";
import { isMissingSchema } from "../lib/supabase";
import { scriptDb } from "./lib/db";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    separator: { type: "string" },
    column: { type: "string", multiple: true },
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    rescore: { type: "boolean", default: false },
    only: { type: "string" },
    status: { type: "string" },
    team: { type: "string" },
    league: { type: "string" },
    moment: { type: "string" },
    sample: { type: "boolean", default: false },
    to: { type: "string" },
    source: { type: "string" },
    note: { type: "string" },
    reason: { type: "string" },
  },
});

function usage(message?: string): never {
  if (message) console.error(message);
  console.error(`
  npm run prospects -- import storeleads.csv [--separator "|"] [--column region="HQ State"] [--dry-run]
  npm run prospects -- score [--limit 50] [--rescore] [--only frostbuddy.com]
  npm run prospects -- list [--status qualified] [--limit 30]
  npm run prospects -- show frostbuddy.com
  npm run prospects -- contacts apollo.csv [--source apollo] [--dry-run]
  npm run prospects -- pitch frostbuddy.com [--team Chargers] [--moment <id> | --sample] [--to sam@frostbuddy.com]
  npm run prospects -- mark <pitch link> sent|replied|bounced|unsubscribed
  npm run prospects -- status frostbuddy.com ${PROSPECT_STATUSES.join("|")} [--note "..."]
  npm run prospects -- block <email or domain> [--reason "..."]`);
  process.exit(1);
}

const HOUR = 3_600_000;
const fmt = (n: number) => n.toLocaleString("en-US");
const money = (n: number | null) => (n === null ? "?" : `$${fmt(Math.round(n))}`);

function readFile(path: string | undefined, what: string): ReturnType<typeof readCsv> {
  if (!path) usage(`Give the ${what}.`);
  try {
    return readCsv(readFileSync(path, "utf8"));
  } catch (err) {
    usage(`Couldn't read ${path}: ${err instanceof Error ? err.message : err}`);
  }
}

/** Which column each field came from, and what was dropped. */
function printReadReport(report: ReadReport) {
  console.log(`Read ${fmt(report.rows)} rows, kept ${fmt(report.kept)}.`);
  for (const [field, columns] of Object.entries(report.columns)) {
    console.log(`  ${field.padEnd(15)} ${columns.length ? columns.map((c) => `"${c}"`).join(", ") : "(no column)"}`);
  }
  for (const [reason, n] of Object.entries(report.skipped)) console.log(`  skipped ${fmt(n)}: ${reason}`);
}

/** --column region="HQ State" */
function columnFlags(): Partial<Record<ProspectField, string>> {
  return Object.fromEntries(
    (args.column ?? []).map((c) => {
      const [field, ...header] = c.split("=");
      if (!header.length) usage(`--column takes field=Header, like region="HQ State".`);
      return [field.trim(), header.join("=").trim().replace(/^"|"$/g, "")];
    }),
  );
}

// Connects on first use, so a --dry-run import works before the keys are set.
let client: ReturnType<typeof scriptDb> | undefined;
const db = () => (client ??= scriptDb());

async function findProspect(ref: string | undefined): Promise<Prospect> {
  const domain = ref ? domainOf(ref) : null;
  if (!domain) usage("Give the store's domain, like frostbuddy.com.");
  const p = await prospectByDomain(db(), domain);
  if (!p) usage(`${domain} isn't a prospect yet. Import it first.`);
  return p;
}

/** Runs fn over items, a few at a time. */
async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const teamName = (key: string | null) => (key ? (teamByKey(key)?.team.name ?? key) : null);

async function main() {
  const [command, ...rest] = positionals;
  const now = new Date();

  if (command === "import") {
    const { headers, rows } = readFile(rest[0], "Store Leads export: npm run prospects -- import storeleads.csv");
    let parsed: ReturnType<typeof parseProspects>;
    try {
      parsed = parseProspects(headers, rows, { separator: args.separator, columns: columnFlags() });
    } catch (err) {
      usage(err instanceof Error ? err.message : String(err));
    }
    printReadReport(parsed.report);
    const located: NewProspect[] = [];
    let unplaced = 0;
    for (const p of parsed.prospects) {
      const { area } = await locate(p);
      if (!area) unplaced++;
      located.push({ ...p, home_area: area?.key ?? null, home_teams: area ? homeTeams(area) : [] });
    }
    if (args["dry-run"]) {
      for (const p of located.slice(0, 5)) {
        console.log(`\n${p.domain}  ${p.name ?? ""}\n  ${[p.city, p.region, p.country].filter(Boolean).join(", ") || "no location"}, ${money(p.monthly_sales)}/mo, ${p.product_count ?? "?"} products`);
        console.log(`  home teams: ${p.home_teams.map((t) => t.name).join(", ") || "none"}`);
        console.log(`  messaging:  ${messagingApps(p.apps).join(", ") || "none found"}`);
      }
      console.log(`\n${fmt(unplaced)} of ${fmt(located.length)} couldn't be placed in the US, Canada or the UK. Nothing saved (--dry-run).`);
      return;
    }
    const { added, updated } = await upsertProspects(db(), located, now);
    console.log(`\nAdded ${fmt(added)} stores, refreshed ${fmt(updated)}. ${fmt(unplaced)} have no home teams (not placed in the US, Canada or the UK).`);
    console.log("Next: npm run prospects -- score");
    return;
  }

  if (command === "score") {
    const limit = Number(args.limit ?? 50);
    if (!Number.isInteger(limit) || limit < 1) usage("--limit takes a whole number.");
    const list = args.only ? [await findProspect(args.only)] : await prospectsToScore(db(), { limit, rescore: args.rescore });
    if (!list.length) return console.log(args.rescore ? "No prospects to score." : "No new prospects to score. --rescore scores the rest again.");
    console.log(`Scoring ${fmt(list.length)} stores from their public product feeds...`);
    let qualified = 0;
    await eachLimit(list, 4, async (p) => {
      try {
        const r = await scoreProspect(p.store_url ?? `https://${p.domain}`, p.home_teams);
        await saveScore(db(), p.id, r, now);
        if (r.verdict === "qualified") qualified++;
        console.log(`  ${r.verdict === "qualified" ? "qualified" : "skipped  "} ${r.score.toFixed(2)}  ${p.domain}: ${r.reason}${r.note ? ` ${r.note}` : ""}`);
      } catch (err) {
        // One store's surprise doesn't stop the rest; it stays new for the next run.
        if (isMissingSchema(err as { code?: string })) throw err;
        console.log(`  error     -     ${p.domain}: ${err instanceof Error ? err.message : err}`);
      }
    });
    console.log(`\n${fmt(qualified)} of ${fmt(list.length)} qualified. Next: npm run prospects -- list --status qualified`);
    return;
  }

  if (command === "list") {
    const status = args.status as ProspectStatus | undefined;
    if (status && !PROSPECT_STATUSES.includes(status)) usage(`--status is one of ${PROSPECT_STATUSES.join(", ")}.`);
    const counts = await Promise.all(
      PROSPECT_STATUSES.map(async (s) => {
        const { count, error } = await db().from("prospects").select("id", { count: "exact", head: true }).eq("status", s);
        if (error) throw error;
        return `${s} ${fmt(count ?? 0)}`;
      }),
    );
    console.log(counts.join(" · "));
    const rows = await listProspects(db(), { status, limit: Number(args.limit ?? 30) });
    for (const p of rows) {
      const team = teamName(p.best_team);
      console.log(
        `${p.score === null ? "  -  " : p.score.toFixed(2)}  ${p.status.padEnd(9)}  ${p.domain}  ${p.name ?? ""}` +
          `${team ? `  · ${team}` : ""}  · ${money(p.monthly_sales)}/mo${messagingApps(p.apps).length ? `  · ${messagingApps(p.apps).join(", ")}` : ""}`,
      );
    }
    return;
  }

  if (command === "show") {
    const p = await findProspect(rest[0]);
    const [contacts, pitches] = await Promise.all([contactsFor(db(), p.id), outreachFor(db(), p.id)]);
    console.log(`${p.name ?? p.domain} (${p.domain}): ${p.status}${p.score === null ? "" : `, score ${p.score.toFixed(2)}`}`);
    console.log(`  ${[p.city, p.region, p.country].filter(Boolean).join(", ") || "no location"} · ${money(p.monthly_sales)}/mo · ${p.product_count ?? "?"} products · ${p.platform ?? "?"}`);
    console.log(`  messaging: ${messagingApps(p.apps).join(", ") || "none found"}`);
    console.log(`  home teams: ${p.home_teams.map((t) => t.name).join(", ") || "none"}`);
    if (p.score_detail) {
      console.log(`  ${p.score_detail.reason}${p.score_detail.note ? ` ${p.score_detail.note}` : ""}`);
      for (const t of p.score_detail.teams) {
        console.log(`    ${t.score.toFixed(2)}  ${t.name}: ${t.picks.map((x) => (x.colorway ? `${x.title} in ${x.colorway}` : x.title)).join(", ") || "nothing close"}`);
      }
    }
    if (p.notes) console.log(`  notes: ${p.notes}`);
    console.log(contacts.length ? "Contacts:" : "No contacts yet: npm run prospects -- contacts apollo.csv");
    for (const c of contacts) console.log(`  ${c.name ?? ""} <${c.email}>${c.title ? `, ${c.title}` : ""}${c.email_status ? ` (${c.email_status})` : ""}`);
    if (pitches.length) console.log("Pitches:");
    for (const o of pitches) {
      const seen = o.views ? `${o.views} view${o.views === 1 ? "" : "s"}, last ${o.last_viewed_at}` : "not opened";
      console.log(`  ${o.created_at.slice(0, 10)}  ${o.status.padEnd(12)} ${teamName(o.team_key)} · ${o.subject} · ${seen}\n    ${siteOrigin()}/p/${o.token}`);
    }
    return;
  }

  if (command === "contacts") {
    const { headers, rows } = readFile(rest[0], "contact export: npm run prospects -- contacts apollo.csv");
    const { contacts, report } = parseContacts(headers, rows);
    printReadReport(report);
    if (args["dry-run"]) {
      for (const c of contacts.slice(0, 5)) console.log(`  ${c.name ?? ""} <${c.email}>, ${c.title ?? "no title"} at ${contactDomain(c) ?? c.company ?? "?"}`);
      return console.log("Nothing saved (--dry-run).");
    }
    const blocked = new Set(await blockedBy(db(), contacts.flatMap((c) => [c.email, contactDomain(c) ?? ""])));
    const allowed = contacts.filter((c) => !blocked.has(c.email) && !blocked.has(contactDomain(c) ?? ""));
    if (allowed.length < contacts.length) console.log(`  left out ${fmt(contacts.length - allowed.length)} on the do-not-contact list`);
    const { saved, unmatched } = await addContacts(db(), allowed, args.source ?? "csv");
    console.log(`\nSaved ${fmt(saved)} people.`);
    if (unmatched.length) {
      console.log(`${fmt(unmatched.length)} work at stores that aren't prospects (import the store first), like:`);
      for (const c of unmatched.slice(0, 5)) console.log(`  ${c.email} (${contactDomain(c) ?? c.company ?? "no company domain"})`);
    }
    return;
  }

  if (command === "pitch") {
    const p = await findProspect(rest[0]);
    if ((await blockedBy(db(), [p.domain])).length) usage(`${p.domain} is on the do-not-contact list.`);

    // The moment first: a real one names its own team.
    let moment: CampaignMoment | null = null;
    let team: TeamRef;
    if (args.moment) {
      const row = await momentById(db(), args.moment);
      moment = row ? momentFromRow(row) : null;
      if (!moment) usage("No moment with that id that Walkoff can map to a team.");
      if (!PITCH_MOMENTS.includes(moment.type)) usage(`That's a ${typeName(moment.type).toLowerCase()}, not a win. Pitch on a win, or pass --sample.`);
      team = moment.team;
    } else if (args.team) {
      const r = resolveTeam(args.team, { league: args.league, prefer: p.home_teams.map((h) => h.key) });
      if ("error" in r) usage(r.error);
      team = r.team;
    } else {
      const key = p.best_team ?? p.home_teams[0]?.key;
      const ref = key ? teamByKey(key) : null;
      if (!ref) usage(`${p.domain} has no home team. Pass --team.`);
      team = ref;
    }

    const keys = teamKeys(team.key);
    let picks = p.score_detail?.teams.find((t) => keys.includes(t.key))?.picks;
    if (!picks?.length) {
      const r = await scoreProspect(p.store_url ?? `https://${p.domain}`, [{ key: team.key, name: team.team.name, share: 0 }]);
      picks = r.best?.picks ?? [];
      if (!picks.length) usage(r.products ? `Nothing in ${possessive(p.domain)} catalog is close to the ${possessive(team.team.name)} colors.` : r.reason);
    }

    if (!moment && !args.sample) {
      const recent = await recentMoments(db(), {
        teamIds: keys.map((k) => feedIdOf(teamByKey(k)!)),
        since: new Date(now.getTime() - 72 * HOUR),
        types: PITCH_MOMENTS,
        limit: 1,
      });
      moment = recent[0] ? momentFromRow(recent[0]) : null;
    }
    moment ??= sampleMoment(team, now);

    const contacts = await contactsFor(db(), p.id);
    const wanted = args.to?.trim().toLowerCase();
    const to = wanted ? contacts.find((c) => c.email === wanted) : contacts[0];
    if (wanted && !to) usage(`${wanted} isn't a contact at ${p.domain}. Add them with: npm run prospects -- contacts people.csv`);
    if (to && (await blockedBy(db(), [to.email])).length) usage(`${to.email} is on the do-not-contact list.`);

    const token = newPitchToken();
    const link = `${siteOrigin()}/p/${token}`;
    const pitch = buildPitch({
      prospect: p,
      team,
      picks,
      moment,
      contact: to ?? null,
      link,
      sender: { name: process.env.OUTREACH_SENDER?.trim() || null, address: process.env.OUTREACH_ADDRESS?.trim() || null },
      now,
    });
    await createOutreach(db(), {
      prospect_id: p.id,
      contact_id: to?.id ?? null,
      token,
      team_key: team.key,
      moment_id: moment.id,
      moment_type: moment.type,
      campaign: pitch.page,
      subject: pitch.email.subject,
      body: pitch.email.body,
    });

    console.log(`Pitch for ${p.name ?? p.domain}: ${team.team.name}, ${moment.id ? `${typeName(moment.type)} (${moment.headline})` : "a sample for their next win"}.`);
    console.log(`  Page:    ${link}`);
    console.log(`  Preview: ${link}?preview=1  (opening this one isn't counted as their view)`);
    console.log(`\nTo:      ${to ? `${to.name ?? ""} <${to.email}>${to.title ? `, ${to.title}` : ""}` : "nobody yet (npm run prospects -- contacts people.csv)"}`);
    console.log(`Subject: ${pitch.email.subject}\n\n${pitch.email.body}\n`);
    for (const w of pitch.warnings) console.log(`Note: ${w}`);
    console.log(`Send it from your outreach inbox, then: npm run prospects -- mark ${token} sent`);
    return;
  }

  if (command === "mark") {
    const token = tokenOf(rest[0] ?? "");
    const status = rest[1] as OutreachStatus;
    if (!token || !OUTREACH_STATUSES.includes(status) || status === "drafted") {
      usage("Give the pitch link and what happened: sent, replied, bounced or unsubscribed.");
    }
    const o = await outreachByToken(db(), token);
    if (!o) usage("No pitch with that link.");
    const blocked = await setOutreachStatus(db(), o, status, now);
    const after: Record<string, string> = {
      sent: "Marked sent, and the store as contacted.",
      replied: "Marked replied, and the store too.",
      bounced: blocked
        ? `Marked bounced. ${blocked} is on the do-not-contact list.`
        : "Marked bounced. This pitch had no address on file, so block the one you sent it to: npm run prospects -- block <email>",
      unsubscribed: blocked
        ? `Marked unsubscribed. ${blocked} is on the do-not-contact list, so no pitch will go to it again.`
        : "Marked unsubscribed, but nothing is on the do-not-contact list yet: npm run prospects -- block <email>",
    };
    console.log(after[status]);
    return;
  }

  if (command === "status") {
    const p = await findProspect(rest[0]);
    const status = rest[1] as ProspectStatus;
    if (!PROSPECT_STATUSES.includes(status)) usage(`The status is one of ${PROSPECT_STATUSES.join(", ")}.`);
    await setProspectStatus(db(), p.id, status, args.note);
    console.log(`${p.domain} is now ${status}.`);
    return;
  }

  if (command === "block") {
    const raw = rest[0]?.trim().toLowerCase() ?? "";
    const value = raw.includes("@") ? raw : domainOf(raw);
    if (!value) usage("Give an email address or a domain.");
    await addDoNotContact(db(), [value], args.reason ?? null);
    console.log(`${value} is on the do-not-contact list. pitch refuses it from now on.`);
    return;
  }

  usage(command ? `Unknown command ${command}.` : undefined);
}

main().catch((err) => {
  if (isMissingSchema(err)) usage("The outreach tables aren't there yet. Run supabase/012_outreach.sql in the Supabase SQL editor first.");
  console.error(err);
  process.exit(1);
});
