// A pitch: the sample campaign Walkoff would have built for a prospect's
// home team, from the prospect's own catalog, and the short email that
// links to it. The campaign comes from buildCampaign, so it follows the
// copy rules a brand without a license gets: colors and the city, never
// the team. The email is written to the marketer, so it names the team.
// Every claim in it is true today: moments arrive about a minute after the
// final whistle, Claude drafts in Klaviyo, and nothing sends without an OK.
import type { Pick } from "../affinity/pick";
import type { Circle } from "../mcp/audience";
import { teamAudience } from "../mcp/audience";
import { buildCampaign, type CampaignMoment, type CampaignProduct } from "../mcp/campaign";
import type { MomentRow } from "../mcp/data";
import { isPro, teamFromFeedId, type TeamRef } from "../mcp/teams";
import { localTime, teamTimeZone, type SendTiming } from "../mcp/timing";
import { PRICING } from "../pricing";
import { ALL_TRIGGERS } from "../triggers";

/** Results worth a pitch the morning after, and how the email says them. */
const WON: Record<string, string> = {
  team_win: "won",
  walkoff_win: "won it on a walk-off",
  buzzer_beater: "won it at the buzzer",
  late_winner: "won it late",
  comeback_win: "came back to win",
  rivalry_win: "won the rivalry game",
  playoff_clinch: "clinched a playoff spot",
  playoff_advance: "advanced",
  title_won: "won it all",
};

export const PITCH_MOMENTS = Object.keys(WON);

/** "won", "won it at the buzzer", "came back to win". */
export const wonPhrase = (type: string) => WON[type] ?? "won";

const MINUTE = 60_000;

/** What the private page shows, saved with the pitch so it never changes. */
export interface PitchPage {
  prospect: { name: string; domain: string };
  team: { key: string; name: string; colors: string[]; tz: string };
  /** A real result, or a sample when there's been none lately. */
  moment: { id: string | null; type: string; type_name: string; occurred_at: string | null };
  subject: string;
  preview_text: string;
  products: CampaignProduct[];
  /** The email, ready to show in a frame: Klaviyo's tags filled in. */
  html: string;
  audience: { segment_name: string; circles: Circle[]; includes_home: boolean; coverage: number };
  send: SendTiming;
  copy_rules: string[];
  built_at: string;
}

export interface Pitch {
  page: PitchPage;
  email: { subject: string; body: string };
  warnings: string[];
}

export interface PitchInput {
  prospect: { name: string | null; domain: string; store_url: string | null };
  team: TeamRef;
  picks: Pick[];
  /** From momentFromRow, or sampleMoment. */
  moment: CampaignMoment;
  contact: { first_name: string | null } | null;
  /** The pitch page: www.walkoff.io/p/<token>. */
  link: string;
  /** Who signs: "Aaron, founder of Walkoff". And the postal address every
   *  commercial email must carry (CAN-SPAM). */
  sender: { name: string | null; address: string | null };
  now: Date;
}

/** A moment from the database, as buildCampaign takes it. */
export function momentFromRow(row: MomentRow, gameStart: Date | null = null): CampaignMoment | null {
  const team = teamFromFeedId(row.team_id);
  if (!team) return null;
  return {
    id: row.id,
    type: row.type,
    phase: row.phase,
    headline: row.headline,
    intensity: row.intensity,
    occurredAt: new Date(row.occurred_at),
    gameStart,
    team,
  };
}

/** When the team hasn't won lately: what Walkoff builds on their next win. */
export function sampleMoment(team: TeamRef, now: Date): CampaignMoment {
  return { id: null, type: "team_win", phase: "after", headline: "Sample: Win", intensity: 0.6, occurredAt: now, gameStart: null, team };
}

/** "the Chargers", "UCLA", "Arsenal": the team as a sentence names it. */
export function teamPhrase(t: TeamRef): string {
  if (isPro(t.league)) return `the ${t.team.nickname}`;
  return t.league === "epl" ? t.team.name : t.team.location;
}

/** "When the Chargers win", "When UCLA wins". */
export const winVerb = (t: TeamRef) => (isPro(t.league) || t.league === "epl" ? "win" : "wins");

/** "Chargers territory", "Bruins territory", "Arsenal territory". */
export const territoryName = (t: TeamRef) => `${t.league === "epl" ? t.team.name : t.team.nickname} territory`;

/** "last night", "yesterday", "on Sunday": when it happened, from now,
 *  where the team plays. */
export function whenPhrase(at: Date, now: Date, tz: string): string {
  const a = localTime(at, tz);
  const n = localTime(now, tz);
  const days = Math.round((Date.UTC(n.year, n.month - 1, n.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
  if (days <= 0) return a.hour >= 17 ? "tonight" : "today";
  if (days === 1) return a.hour >= 17 ? "last night" : "yesterday";
  return `on ${a.weekday}`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Frost Buddy's", "Outdoor Voices'". */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** The campaign's HTML as a page shows it: Klaviyo's tags filled in, links
 *  opening nowhere (the frame allows no new windows) and no referrer sent
 *  for the store's photos. */
export function pageHtml(html: string, brand: string): string {
  return html
    .replace("<head>", '<head>\n<base target="_blank">\n<meta name="referrer" content="no-referrer">')
    .replace("{{ organization.name }}", esc(brand))
    .replace("{{ organization.full_address }}", "Your store&#39;s address")
    .replace("{% unsubscribe %}", '<span style="text-decoration:underline;">Unsubscribe</span>');
}

/** The email to the prospect: short, plain text, one link. */
function pitchEmail(input: PitchInput, brand: string, sample: boolean): { subject: string; body: string } {
  const { team: t, moment, contact, link, sender, now } = input;
  const who = teamPhrase(t);
  const territory = territoryName(t);
  const hi = contact?.first_name ? `Hi ${contact.first_name},` : "Hi there,";
  const lead = sample
    ? `When ${who} ${winVerb(t)}, Walkoff picks it up about a minute after the final whistle and builds an email from your catalog. Here's ${possessive(brand)}, for customers in ${territory}:`
    : `${cap(who)} ${wonPhrase(moment.type)} ${whenPhrase(moment.occurredAt, now, teamTimeZone(t.team))}. Walkoff picks up wins like that about a minute after the final whistle and builds the email from your catalog. Here's ${possessive(brand)}, for customers in ${territory}:`;
  const subject = sample ? `Your ${t.team.nickname} email` : `${cap(who)} won. Here's your email.`;
  const body = [
    hi,
    "",
    lead,
    "",
    link,
    "",
    `Your products in their colors, no license needed, and nothing sends without your OK. Want to try it on the next win? It's free for ${PRICING.trialDays} days.`,
    "",
    sender.name ?? "[your name]",
    "",
    "--",
    sender.address ?? "[your postal address]",
    'Not for you? Reply "no thanks" and I won\'t write again.',
  ].join("\n");
  return { subject, body };
}

export function buildPitch(input: PitchInput): Pitch {
  const { prospect, team: t, picks, moment, now } = input;
  const brand = prospect.name?.trim() || prospect.domain;
  const sample = !moment.id;
  const audience = teamAudience(t);
  // A real result is shown as it was that night: when it would have sent.
  const asOf = sample ? now : new Date(moment.occurredAt.getTime() + 2 * MINUTE);
  const campaign = buildCampaign({
    brand: { name: brand, storeUrl: prospect.store_url, licensed: false },
    moment,
    picks,
    audience,
    options: { now: asOf },
  });
  // The page labels a sample itself; the rest of the campaign's warnings hold.
  const warnings = campaign.warnings.filter((w) => !w.startsWith("This is a sample"));
  if (!input.sender.name || !input.sender.address) {
    warnings.push("Set OUTREACH_SENDER and OUTREACH_ADDRESS: every email needs who it's from and a postal address (CAN-SPAM).");
  }
  if (!sample && now.getTime() - moment.occurredAt.getTime() > 3 * 24 * 60 * MINUTE) {
    warnings.push("That result is more than three days old. A sample for the next win may land better.");
  }
  const typeName = ALL_TRIGGERS.find((x) => x.id === moment.type)?.name ?? moment.type;
  return {
    page: {
      prospect: { name: brand, domain: prospect.domain },
      team: { key: t.key, name: t.team.name, colors: t.team.colors, tz: teamTimeZone(t.team) },
      moment: { id: moment.id, type: moment.type, type_name: typeName, occurred_at: sample ? null : moment.occurredAt.toISOString() },
      subject: campaign.subject_lines[0],
      preview_text: campaign.preview_text,
      products: campaign.products,
      html: pageHtml(campaign.html, brand),
      audience: { segment_name: audience.segment_name, circles: audience.circles, includes_home: audience.includes_home, coverage: audience.coverage },
      send: campaign.send,
      copy_rules: campaign.copy_rules,
      built_at: now.toISOString(),
    },
    email: pitchEmail(input, brand, sample),
    warnings,
  };
}
