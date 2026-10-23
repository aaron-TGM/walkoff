// A ready-made campaign for a moment: subject lines, preview text, a
// finished Klaviyo email, the audience and when to send. Claude polishes the
// words, then creates the draft with the marketer's own Klaviyo connector.
//
// Brands without a team license never name the team. They nod instead: the
// city for pro teams, and always the colors, through products the brand
// already sells in those colors.
import { colorFamily, colorMatch, isNeutral } from "../affinity/colors";
import type { Pick } from "../affinity/pick";
import { TRIGGERS } from "../triggers";
import type { TeamAudience } from "./audience";
import { isPro, type TeamRef } from "./teams";
import { localTime, sendTiming, teamTimeZone, type SendTiming } from "./timing";

export interface CampaignBrand {
  name: string;
  storeUrl: string | null;
  /** Licensed for the team's marks: copy may name the team. */
  licensed: boolean;
}

export interface CampaignMoment {
  /** Null for a sample built before there's a real moment. */
  id: string | null;
  type: string;
  phase: string;
  headline: string;
  intensity: number;
  occurredAt: Date;
  gameStart: Date | null;
  team: TeamRef;
}

export interface CampaignOptions {
  /** "15% off with code BOLT15 through Monday" */
  offer?: string | null;
  currency?: string;
  now?: Date;
}

export interface CampaignProduct {
  handle: string | null;
  title: string;
  colorway: string | null;
  why: string;
  price: string | null;
  url: string | null;
  image: string | null;
  hex: string[];
}

export interface Campaign {
  campaign_name: string;
  /** The idea in one line. */
  angle: string;
  subject_lines: string[];
  preview_text: string;
  headline: string;
  body: string;
  offer: string | null;
  cta: { label: string; url: string | null };
  products: CampaignProduct[];
  /** Complete email HTML with Klaviyo's unsubscribe and address tags. */
  html: string;
  audience: TeamAudience;
  send: SendTiming;
  copy_rules: string[];
  klaviyo_steps: string[];
  warnings: string[];
}

type Kind = "win" | "loss" | "pregame" | "live" | "season";

const KIND: Record<string, Kind> = {
  team_win: "win",
  walkoff_win: "win",
  buzzer_beater: "win",
  late_winner: "win",
  comeback_win: "win",
  rivalry_win: "win",
  heartbreak_loss: "loss",
  rivalry_preview: "pregame",
  big_game_alert: "pregame",
  season_opener: "pregame",
  close_game: "live",
  comeback_live: "live",
  clutch_moment: "live",
  playoff_clinch: "season",
  playoff_advance: "season",
  title_won: "season",
  great_escape: "season",
  player_milestone: "season",
  big_signing: "season",
};

export const momentKind = (type: string): Kind => KIND[type] ?? "win";

/** How fans name their own town, where it differs from the team's location. */
const PLACE: Record<string, string> = {
  "Los Angeles": "LA",
  "Golden State": "the Bay",
  Philadelphia: "Philly",
  Washington: "DC",
  "Oklahoma City": "OKC",
};

/** Fabric words that don't help a color name ("Azure Heather" is azure). */
const FINISH = /\b(heather(ed)?|marl|melange|washed|garment dyed)\b/gi;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Who {
  text: string;
  plural: boolean;
}

interface Ctx {
  Colors: string;
  color: string;
  day: string;
  /** "tonight", "today" or "on Sunday": when the game is, from the send. */
  when: string;
  who: Who | null;
  product: string | null;
}

interface Copy {
  angle: string;
  subjects: string[];
  preview: string;
  headline: string;
  body: string;
}

/** The colors to name, in team-color order: the brand's own words where
 *  they're plain ("Azure and sunflower"), else the team's color families. */
export function colorWords(picks: Pick[], teamColors: string[]): { phrase: string; main: string } {
  const loud = teamColors.map((h, i) => ({ h, i })).filter((c) => !isNeutral(c.h));
  const colors = loud.length ? loud : teamColors.map((h, i) => ({ h, i }));
  const words = new Map<number, string>();
  for (const p of picks) {
    if (!p.hex.length || !colors.length) continue;
    // The team color this pick stands for.
    const best = colors
      .map((c) => ({ i: c.i, m: Math.max(...p.hex.map((h) => colorMatch(c.h, h))) }))
      .sort((a, b) => b.m - a.m)[0];
    const plain = p.colorway?.replace(FINISH, "").replace(/\s+/g, " ").trim().toLowerCase();
    const word = plain && /^[a-z]+( [a-z]+)?$/.test(plain) && plain.length <= 16 ? plain : colorFamily(p.hex[0]);
    if (!words.has(best.i) && ![...words.values()].includes(word)) words.set(best.i, word);
  }
  for (const c of colors) {
    const family = colorFamily(c.h);
    if (!words.has(c.i) && ![...words.values()].includes(family)) words.set(c.i, family);
  }
  const ordered = [...words].sort((a, b) => a[0] - b[0]).map(([, w]) => w);
  const main = colors.length ? colorFamily(colors[0].h) : "team colors";
  return { phrase: ordered.length ? ordered.slice(0, 2).join(" and ") : "team colors", main };
}

function wearing(who: Who | null, time: string): string {
  return who ? `the colors ${who.text} ${who.plural ? "are" : "is"} wearing ${time}` : `the colors everyone's wearing ${time}`;
}

function copyFor(type: string, c: Ctx): Copy {
  const Who = c.who ? cap(c.who.text) : null;
  /** "LA doesn't", "Chargers fans don't". */
  const verb = (one: string, many: string) => (c.who?.plural ? many : one);
  const winBody = (lead: string) => `${lead} We picked a few things in ${wearing(c.who, "today")}.`;
  const winPreview = c.product ? `${cap(c.product)}, and more in the colors you're already wearing.` : "In the colors you're already wearing.";
  const win = (headline: string, second: string, third: string, lead: string): Copy => ({
    angle: "Celebrate the win in their colors while fans are still buzzing.",
    subjects: [`${c.Colors} kind of ${c.day}.`, second, third],
    preview: winPreview,
    headline,
    body: winBody(lead),
  });
  const season = (headline: string, second: string, third: string, lead: string): Copy => ({
    angle: "A season moment: bigger than one win, and it lasts a few days.",
    subjects: [headline, second, third],
    preview: winPreview,
    headline,
    body: `${lead} A few things in ${wearing(c.who, "this week")}.`,
  });
  const pregame = (headline: string, subjects: string[], lead: string): Copy => ({
    angle: "Game-day prep: what to wear to watch.",
    subjects,
    preview: c.product ? `What to wear ${c.when}: ${c.product}, and more.` : `What to wear ${c.when}.`,
    headline,
    body: `${lead} Here's what to wear while you watch.`,
  });

  switch (type) {
    case "team_win":
      return win("That's a win.", Who ? `${Who}, enjoy this one.` : "Enjoy this one.", `Wins look good in ${c.color}.`, "Good game.");
    case "walkoff_win":
      return win("What a finish.", Who ? `${Who}, that finish.` : "That finish.", "Right down to the last second.", "Some wins you feel all week.");
    case "buzzer_beater":
      return win("Down to the buzzer.", "At the buzzer. Obviously.", Who ? `${Who}, you can breathe now.` : "Okay. You can breathe now.", "Some wins you feel all week.");
    case "late_winner":
      return win("Worth staying for the end.", "Late, and worth the wait.", Who ? `${Who}, glad you stayed?` : "Glad you stayed till the end?", "Some wins you feel all week.");
    case "comeback_win":
      return win("Never in doubt.", "Never in doubt. (It was.)", Who ? `${Who} ${verb("doesn't", "don't")} quit.` : "Down, but never out.", "Down, then not.");
    case "rivalry_win":
      return win("Bragging rights.", "Bragging rights look good on you.", Who ? `${Who}, enjoy this one.` : "Enjoy this one. You earned it.", "The best kind of win.");
    case "heartbreak_loss":
      return {
        angle: "Console, don't celebrate: a soft tone, no gloating, and a small offer if you have one.",
        subjects: [`Still ${c.color}. Always.`, "Rough one. Here's a little pick-me-up.", Who ? `${Who}, we're still with you.` : "Some days call for a hoodie."],
        preview: "A few things in the colors you're still wearing.",
        headline: `Still ${c.color}.`,
        body: "Not the ending anyone wanted. Here are a few things in the colors that are always worth wearing.",
      };
    case "rivalry_preview":
      return pregame(
        `${c.Colors} for ${c.when === "tonight" || c.when === "today" ? c.when : c.day}.`,
        [`${c.Colors} for a big ${c.day}.`, "Rivalry week. Dress accordingly.", Who ? `${Who}, you know what ${c.day} is.` : `You know what ${c.day} is.`],
        `Big one ${c.when}.`,
      );
    case "big_game_alert":
      return pregame(
        `Big one ${c.when}.`,
        [`Big one ${c.when}. Dress the part.`, `${c.Colors}, ready for ${c.when === "tonight" || c.when === "today" ? c.when : c.day}.`, Who ? `All eyes on ${c.who!.text} ${c.when}.` : "Clear your schedule."],
        "Clear your schedule.",
      );
    case "season_opener":
      return pregame("It's back.", ["It's back.", "First game, first fit.", `${c.Colors} season starts ${c.when}.`], `A new season starts ${c.when}.`);
    case "close_game":
    case "comeback_live":
    case "clutch_moment":
      return {
        angle: "It's live: best sent once there's a result.",
        subjects: [`${c.Colors} kind of ${c.day}.`, "Nobody sat down for that one.", Who ? `${Who}, deep breaths.` : "Deep breaths."],
        preview: "What to wear for the next one.",
        headline: "Nobody sat down for that one.",
        body: "Edge-of-your-seat stuff. Here's what to wear for the next one.",
      };
    case "playoff_clinch":
      return season("They're in.", `More games. More reasons to wear ${c.color}.`, Who ? `${Who}, the season goes on.` : "The season goes on.", "The season goes on.");
    case "playoff_advance":
      return season("On to the next one.", `Still alive. Still ${c.color}.`, Who ? `${Who} ${verb("isn't", "aren't")} done yet.` : "Not done yet.", "Not done yet.");
    case "title_won":
      return season("The best kind of ending.", `${c.Colors}, all the way.`, Who ? `${Who}, enjoy every minute.` : "Enjoy every minute of this.", "Once in a while, it all comes together.");
    case "great_escape":
      return season("Staying up.", `Relief looks good in ${c.color}.`, "Survived. Barely. Beautifully.", "Relief, at last.");
    default:
      return season(`A good day to wear ${c.color}.`, `${c.Colors} kind of ${c.day}.`, Who ? `Big news, ${c.who!.text}.` : "Big news.", "Big news.");
  }
}

// ── The email ──────────────────────────────────────────────────────

const esc = (s: string) =>
  s
    .replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!)
    // Braces would read as Klaviyo template tags.
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");

const FONT = "Helvetica, Arial, sans-serif";
const hex = (h: string) => `#${h.replace(/^#/, "")}`;

function productCell(p: CampaignProduct, width: number, colWidth: string): string {
  const alt = esc(p.colorway ? `${p.title} in ${p.colorway}` : p.title);
  const swatch = p.hex.length ? p.hex.slice(0, 2) : ["e6e6e3"];
  const visual = p.image
    ? `<img src="${esc(p.image)}" width="${width}" alt="${alt}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;">`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${swatch
        .map((h) => `<td height="${Math.round(width * 1.25)}" style="height:${Math.round(width * 1.25)}px;background:${hex(h)};font-size:0;line-height:0;">&nbsp;</td>`)
        .join("")}</tr></table>`;
  const link = (inner: string) => (p.url ? `<a href="${esc(p.url)}" style="text-decoration:none;color:inherit;">${inner}</a>` : inner);
  const meta = [p.colorway, p.price].filter(Boolean).map((x) => esc(x!)).join(" · ");
  return `<td class="wo-col" width="${colWidth}" valign="top" style="padding:0 10px 24px;">
${link(visual)}
<p style="margin:12px 0 2px;font-family:${FONT};font-size:14px;line-height:1.35;font-weight:700;color:#111111;">${link(esc(p.title))}</p>
${meta ? `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.4;color:#6b6b6b;">${meta}</p>` : ""}
${p.url ? `<p style="margin:8px 0 0;font-family:${FONT};font-size:13px;"><a href="${esc(p.url)}" style="color:#111111;text-decoration:underline;">Shop${p.colorway ? ` ${esc(p.colorway)}` : ""}</a></p>` : ""}
</td>`;
}

export function renderEmail(e: {
  brand: string;
  subject: string;
  preview: string;
  headline: string;
  body: string;
  offer: string | null;
  products: CampaignProduct[];
  cta: { label: string; url: string | null };
  stripe: string[];
}): string {
  const n = e.products.length;
  const [width, colWidth] = n >= 3 ? [164, "33%"] : n === 2 ? [250, "50%"] : [320, "100%"];
  const stripe = (e.stripe.length ? e.stripe : ["111111"]).slice(0, 2);
  const grid = n
    ? `<tr><td class="wo-pad" style="padding:28px 30px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${e.products.slice(0, 3).map((p) => productCell(p, width, colWidth)).join("\n")}
</tr></table>
</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(e.subject)}</title>
<style>
@media (max-width: 520px) {
  .wo-col { display: block !important; width: 100% !important; max-width: 100% !important; }
  .wo-col img { max-width: 100% !important; }
  .wo-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .wo-h1 { font-size: 30px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(e.preview)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">
<tr><td style="font-size:0;line-height:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${stripe.map((h) => `<td height="8" width="${Math.round(100 / stripe.length)}%" style="height:8px;background:${hex(h)};font-size:0;line-height:0;">&nbsp;</td>`).join("")}
</tr></table>
</td></tr>
<tr><td class="wo-pad" style="padding:28px 40px 0;font-family:${FONT};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6b6b6b;">${esc(e.brand)}</td></tr>
<tr><td class="wo-pad" style="padding:18px 40px 0;"><h1 class="wo-h1" style="margin:0;font-family:${FONT};font-size:38px;line-height:1.08;font-weight:700;color:#111111;">${esc(e.headline)}</h1></td></tr>
<tr><td class="wo-pad" style="padding:16px 40px 0;font-family:${FONT};font-size:16px;line-height:1.55;color:#333333;">${esc(e.body)}</td></tr>
${e.offer ? `<tr><td class="wo-pad" style="padding:16px 40px 0;"><p style="margin:0;padding:12px 16px;border:1px solid #111111;font-family:${FONT};font-size:15px;line-height:1.4;font-weight:700;color:#111111;">${esc(e.offer)}</p></td></tr>` : ""}
${grid}
${e.cta.url ? `<tr><td align="center" class="wo-pad" style="padding:12px 40px 40px;"><a href="${esc(e.cta.url)}" style="display:inline-block;background:#111111;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:4px;">${esc(e.cta.label)}</a></td></tr>` : `<tr><td style="padding:0 0 24px;"></td></tr>`}
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:20px 40px;font-family:${FONT};font-size:12px;line-height:1.6;color:#8a8a8a;text-align:center;">
{{ organization.name }}<br>{{ organization.full_address }}<br><br>{% unsubscribe %}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Putting it together ────────────────────────────────────────────

function money(price: number | null | undefined, currency: string): string | null {
  if (price === null || price === undefined || !Number.isFinite(price)) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: Number.isInteger(price) ? 0 : 2 }).format(price);
  } catch {
    return String(price);
  }
}

function copyRules(brand: CampaignBrand, t: TeamRef): string[] {
  if (brand.licensed) {
    return [
      `${brand.name} is licensed for team marks, so naming the ${t.team.nickname} is fine within the license.`,
      "Keep players' names and photos out unless the license covers them, and use league marks only if it does.",
      "Walkoff's rules lower the risk but aren't legal advice.",
    ];
  }
  const rules = [
    "Never name the team, league, players, coaches, stadium, rivalry or event. No team names, nicknames or abbreviations, and no event names like the Super Bowl or World Series: say \"the big game\".",
    "No logos, mascots, jerseys, numbers, slogans or game footage. Show the brand's own products.",
    "Don't say or imply the brand is official, licensed or endorsed.",
    "Leave scores and play-by-play out. \"What a finish\" does the job.",
  ];
  rules.push(
    isPro(t.league)
      ? "Nod with the city and the colors: that's the whole signal."
      : "Nod with the colors only. For college teams and clubs the place is the name, so skip place names too.",
  );
  rules.push("Walkoff's rules lower the risk but aren't legal advice. When in doubt, ask counsel.");
  return rules;
}

export function buildCampaign(input: {
  brand: CampaignBrand;
  moment: CampaignMoment;
  picks: Pick[];
  audience: TeamAudience;
  options?: CampaignOptions;
}): Campaign {
  const { brand, moment, picks, audience } = input;
  const options = input.options ?? {};
  const now = options.now ?? new Date();
  const t = moment.team;
  const tz = teamTimeZone(t.team);
  const kind = momentKind(moment.type);
  const warnings: string[] = [];

  const send = sendTiming({ phase: moment.phase, occurredAt: moment.occurredAt, gameStart: moment.gameStart, tz, now });
  const sendAt = localTime(new Date(send.send_at_utc), tz);
  let when = `on ${sendAt.weekday}`;
  if (moment.gameStart) {
    const game = localTime(moment.gameStart, tz);
    const sameDay = game.year === sendAt.year && game.month === sendAt.month && game.day === sendAt.day;
    when = sameDay ? (game.hour >= 17 ? "tonight" : "today") : `on ${game.weekday}`;
  }

  const store = brand.storeUrl?.replace(/\/+$/, "") ?? null;
  const currency = options.currency ?? (t.team.country === "GB" ? "GBP" : t.team.country === "CA" ? "CAD" : "USD");
  const products: CampaignProduct[] = picks.slice(0, 3).map((p) => ({
    handle: p.handle ?? null,
    title: p.title,
    colorway: p.colorway,
    why: p.why,
    price: money(p.price, currency),
    url: store && p.handle ? `${store}/products/${encodeURIComponent(p.handle)}` : null,
    image: /^https?:\/\//.test(p.image) ? p.image : null,
    hex: p.hex,
  }));

  const { phrase, main } = colorWords(picks, t.team.colors);
  const place = PLACE[t.team.location] ?? t.team.location;
  // The city only when it's where the audience lives.
  const who: Who | null = brand.licensed
    ? { text: `${t.team.nickname} fans`, plural: true }
    : isPro(t.league) && (audience.includes_home || !audience.circles.length)
      ? { text: place, plural: false }
      : null;
  const first = products[0];
  const copy = copyFor(moment.type, {
    Colors: cap(phrase),
    color: main,
    day: sendAt.weekday,
    when,
    who,
    product: first ? `the ${first.title}${first.colorway ? ` in ${first.colorway}` : ""}` : null,
  });
  const subjects = brand.licensed && (kind === "win" || kind === "season") ? [`${t.team.nickname} win. ${copy.subjects[0]}`, ...copy.subjects.slice(1)] : copy.subjects;
  const offer = options.offer?.trim() || null;
  const cta = { label: "Shop the colors", url: store ?? first?.url ?? null };

  const typeName = TRIGGERS.find((x) => x.id === moment.type)?.name ?? moment.type;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(moment.occurredAt);
  const name = `Walkoff · ${t.team.name} · ${typeName} · ${date}`;

  if (!moment.id) warnings.push(`This is a sample: there's no real ${typeName.toLowerCase()} for the ${t.team.name} yet. Use it to preview, not to send.`);
  if (kind === "live") warnings.push("This moment is still live. Setting up a campaign takes a few minutes, so wait for the result: a win brings its own moment.");
  if (kind === "loss") warnings.push("A loss: keep it gentle. No celebrating, no jokes at the fans' expense, and consider skipping if the brand's voice is loud.");
  if (moment.type === "title_won" && !brand.licensed) {
    warnings.push("Title moments are the most closely policed. Colors and the city only: no trophy, no \"champions\" merchandise claims, no event or league names.");
  }
  const ageHours = (now.getTime() - moment.occurredAt.getTime()) / 3_600_000;
  if (moment.id && (kind === "win" || kind === "loss") && ageHours > 36) {
    warnings.push(`This moment is ${Math.round(ageHours)} hours old. Most of the lift comes in the first day, so it may be past its window.`);
  }
  if (kind === "pregame" && moment.gameStart && moment.gameStart.getTime() <= now.getTime()) {
    warnings.push("The game has already started, so the pre-game window has closed.");
  }
  if (!products.length) warnings.push("No products in the team's colors. Upload a catalog with colorways, or name products to feature.");
  if (!store) warnings.push("No store address on file, so the email has no links. Pass store_url, or ask your Walkoff contact to add it.");
  if (audience.customers && audience.customers.in_circles < 100) {
    const n = audience.customers.in_circles;
    warnings.push(
      `${n ? `Only about ${n}` : "None"} of the brand's uploaded customers live in this audience. Consider reach "wide", or skipping.`,
    );
  }
  if (!audience.circles.length) warnings.push("Walkoff couldn't draw an audience for this team. Target a broader segment by hand.");

  const steps = [
    `Audience: with the Klaviyo connector, look for a segment named "${audience.segment_name}" (get_segments). If it isn't there, ask the marketer to create it once, following audience.klaviyo_segment_steps. Don't send a team moment to the whole list.`,
    `Template: create an email template named "${name}" from html (create_email_template).`,
    `Draft: create a campaign named "${name}" for that segment with subject "${subjects[0]}" and preview text "${copy.preview}" (create_campaign), then assign the template to its message (assign_template_to_campaign_message).`,
    `Check: render the template (render_email_template) and show the marketer the email, the audience and the send time: ${send.send_at_local}.`,
    `Send: schedule it for ${send.send_at_local} (${send.send_at_utc}) if the Klaviyo connector can schedule; otherwise ask the marketer to schedule it in Klaviyo.`,
  ];
  if (moment.id) steps.push(`Log it: call log_send with moment_id ${moment.id}, status "drafted" (or "sent" once scheduled) and the Klaviyo campaign id.`);

  const html = renderEmail({
    brand: brand.name,
    subject: subjects[0],
    preview: copy.preview,
    headline: copy.headline,
    body: copy.body,
    offer,
    products,
    cta,
    stripe: t.team.colors,
  });

  return {
    campaign_name: name,
    angle: copy.angle,
    subject_lines: subjects,
    preview_text: copy.preview,
    headline: copy.headline,
    body: copy.body,
    offer,
    cta,
    products,
    html,
    audience,
    send,
    copy_rules: copyRules(brand, t),
    klaviyo_steps: steps,
    warnings,
  };
}
