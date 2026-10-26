// A campaign for a hometown moment: the town celebrates. The audience is
// one circle around the town, the products are ones named for the town
// first and then the champion's colors, and the copy names the town, never
// the athlete (lib/hometown/copy.ts). Server-only: the circle comes from
// lib/places.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AreaCount } from "../affinity/compute";
import { pickForInterest, pickForTeam, pickForTown, plain, type Pick, type PickProduct } from "../affinity/pick";
import { namingRights } from "../athletes";
import { hometownCopy, hometownRules } from "../hometown/copy";
import type { HometownDetail, HometownType } from "../hometown/derive";
import { placeByKey, placeLabel, townCircle, townCustomers, townLift, type Place, type TownCircle } from "../places";
import { COUNTRY_NAME, klaviyoSegment, type Circle, type KlaviyoSegment } from "./audience";
import { colorWords, KLAVIYO_TOOLS, money, renderEmail, type Campaign, type CampaignBrand, type CampaignOptions, type CampaignProduct } from "./campaign";
import { ToolError, typeName, type MomentRow } from "./data";
import { teamFromFeedId, type TeamRef } from "./teams";
import { localTime, sendTiming, teamTimeZone } from "./timing";

export interface TownAudience {
  segment_name: string;
  /** "San Clemente, CA". */
  town: string;
  /** One circle around the town. */
  circles: Circle[];
  /** People inside, estimated. */
  population: number;
  /** From the brand's customer counts, when there are any: Klaviyo's count
   *  for the same circle is the real one. */
  customers?: { in_circle: number; lift: number | null; uploaded: number; method: string };
  klaviyo_segment: KlaviyoSegment;
  klaviyo_segment_steps: string[];
}

export const townSegmentName = (town: string, radiusMiles: number) => `Walkoff · ${town} (${radiusMiles} mi)`;

/** The town's circle as a Klaviyo segment, with the brand's customers in
 *  it when its counts are given. */
export function townAudience(town: string, circle: TownCircle, opts: { customers?: number; lift?: number | null; counts?: AreaCount[] } = {}): TownAudience {
  const name = townSegmentName(town, circle.radiusMiles);
  const code = circle.country === "GB" ? circle.ref.split(" ")[0] : circle.ref;
  const circles: Circle[] = [{ postal_code: code, country: circle.country, radius_miles: circle.radiusMiles, center_area: `around ${code}` }];
  const uploaded = Math.round((opts.counts ?? []).reduce((s, c) => s + Math.max(0, Number(c.customers) || 0), 0));
  return {
    segment_name: name,
    town,
    circles,
    population: circle.population,
    ...(opts.customers !== undefined ? { customers: { in_circle: opts.customers, lift: opts.lift ?? null, uploaded, method: circle.method } } : {}),
    klaviyo_segment: klaviyoSegment(name, circles),
    klaviyo_segment_steps: [
      `In Klaviyo, open Lists & segments, then Create → Segment, and name it "${name}".`,
      `Add the condition "Someone's proximity to a location": is within ${circle.radiusMiles} miles of ${code} (${COUNTRY_NAME[circle.country]}).`,
      "Save it once. Klaviyo keeps it up to date, so every later moment for this town can reuse it.",
    ],
  };
}

export interface HometownCampaignMoment {
  /** Null for a sample. */
  id: string | null;
  type: HometownType;
  headline: string;
  occurredAt: Date;
  /** Contenders: when the final round starts. */
  gameStart: Date | null;
  town: { label: string; name: string; country: "US" | "CA" | "GB"; region: string };
  /** The champion, for a team's title: its colors carry the copy. */
  team: TeamRef | null;
}

export type HometownCampaign = Omit<Campaign, "audience"> & { audience: TownAudience };

/** Days since 1970 for a local date, to tell today from tomorrow. */
const dayNumber = (l: { year: number; month: number; day: number }) => Date.UTC(l.year, l.month - 1, l.day) / 86_400_000;

export function buildHometownCampaign(input: {
  brand: CampaignBrand;
  moment: HometownCampaignMoment;
  picks: Pick[];
  audience: TownAudience;
  /** An athlete from the town the brand may name, with the agreement's end. */
  mayName?: { name: string; through: string } | null;
  options?: CampaignOptions;
}): HometownCampaign {
  const { brand, moment, picks, audience } = input;
  const mayName = input.mayName ?? null;
  const options = input.options ?? {};
  const now = options.now ?? new Date();
  const tz = teamTimeZone(moment.town);
  const warnings: string[] = [];

  const phase = moment.type === "hometown_contender" ? "before" : "season";
  const send = sendTiming({ phase, occurredAt: moment.occurredAt, gameStart: moment.gameStart, tz, now });
  const sendAt = localTime(new Date(send.send_at_utc), tz);
  let when = `on ${sendAt.weekday}`;
  if (moment.gameStart) {
    const start = localTime(moment.gameStart, tz);
    const days = dayNumber(start) - dayNumber(sendAt);
    when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `on ${start.weekday}`;
  }
  const happened = localTime(moment.occurredAt, tz);

  const store = brand.storeUrl?.replace(/\/+$/, "") ?? null;
  const currency = options.currency ?? (moment.town.country === "GB" ? "GBP" : moment.town.country === "CA" ? "CAD" : "USD");
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
  // The team's colors in the brand's words, from the picks their color
  // earned: a product named for the town is there for its name.
  const colors = moment.team ? colorWords(picks.filter((p) => p.colorway), moment.team.team.colors) : null;
  const first = products[0];
  const copy = hometownCopy({
    type: moment.type,
    town: moment.town.name,
    colors,
    partOfDay: happened.hour >= 17 ? "night" : "day",
    when,
    product: first ? `the ${first.title}${first.colorway ? ` in ${first.colorway}` : ""}` : null,
    mayName: mayName?.name ?? null,
  });
  const offer = options.offer?.trim() || null;
  const cta = { label: colors ? "Shop the colors" : "Shop now", url: store ?? first?.url ?? null };

  const kind = typeName(moment.type);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(moment.occurredAt);
  const name = `Walkoff · ${moment.town.label} · ${kind} · ${date}`;

  if (!moment.id) warnings.push(`This is a sample: there's no real ${kind.toLowerCase()} for ${moment.town.label} yet. Use it to preview, not to send.`);
  if (mayName) {
    warnings.push(`${mayName.name} agreed in writing that ${brand.name} may name them, through ${mayName.through}. Get their OK for this use, and use photos only if the agreement covers them.`);
  }
  const n = audience.customers?.in_circle;
  if (n !== undefined) {
    warnings.push(
      `About ${n} of the brand's customers live in the circle, estimated from postal areas. Klaviyo's count for the segment is the real one: check it before sending.`,
    );
  }
  if (!products.length) warnings.push("No products to feature. Name some, or upload a catalog with colorways.");
  if (!store) warnings.push("No store address on file, so the email has no links. Pass store_url, or ask your Walkoff contact to add it.");

  const steps = [
    `Audience: with the Klaviyo connector, look for a segment named "${audience.segment_name}" (${KLAVIYO_TOOLS.findSegment}). If it isn't there, ask the marketer whether to create it: it's once per town, and every later moment there reuses it. With their OK, create it from audience.klaviyo_segment (${KLAVIYO_TOOLS.createSegment}); if that tool isn't there or fails, they can create it by hand from audience.klaviyo_segment_steps. Send only to that segment, never the whole list.`,
    `Template: create an email template named "${name}" from html (${KLAVIYO_TOOLS.createTemplate}).`,
    `Draft: create a campaign named "${name}" for that segment with subject "${copy.subjects[0]}" and preview text "${copy.preview}" (${KLAVIYO_TOOLS.createCampaign}), then assign the template to its message (${KLAVIYO_TOOLS.assignTemplate}). Keep Smart Sending on, and turn its UTM tracking on, with the account's own parameters.`,
    `Check: render the template (${KLAVIYO_TOOLS.render}) and show the marketer the email, the audience and the send time: ${send.send_at_local}.`,
    `Send: schedule it for ${send.send_at_local} (${send.send_at_utc}) if the Klaviyo connector can schedule; otherwise ask the marketer to schedule it in Klaviyo.`,
  ];
  if (moment.id) steps.push(`Log it: call log_send with moment_id ${moment.id}, status "drafted" (or "sent" once scheduled) and the Klaviyo campaign id.`);
  steps.push(`Results: once it's sent, when the marketer asks how it did, read its numbers from Klaviyo (${KLAVIYO_TOOLS.report}): recipients, clicks, orders and revenue.`);

  const html = renderEmail({
    brand: brand.name,
    subject: copy.subjects[0],
    preview: copy.preview,
    headline: copy.headline,
    body: copy.body,
    offer,
    products,
    cta,
    stripe: moment.team?.team.colors ?? [],
  });

  return {
    campaign_name: name,
    angle: copy.angle,
    subject_lines: copy.subjects,
    preview_text: copy.preview,
    headline: copy.headline,
    body: copy.body,
    offer,
    cta,
    products,
    html,
    audience,
    send,
    copy_rules: hometownRules({ brand: brand.name, licensed: brand.licensed, mayName }),
    klaviyo_steps: steps,
    warnings,
  };
}

// ── From a moment ──────────────────────────────────────────────────

/** What each sport's fans are into, for an athlete without a team. */
const SPORT_INTEREST: Record<string, string> = { golf: "golf", tennis: "tennis", racing: "motorsports", surfing: "surf" };

/** Products for a town: the brand's own named for it first, then the
 *  champion's colors, or for an athlete without a team their sport's
 *  scene. products overrides with the marketer's choice. */
export function townPicks(catalog: PickProduct[], town: string, opts: { team: TeamRef | null; sport: string | null; products?: string[] }): Pick[] {
  if (opts.products?.length) {
    const wanted = new Set(opts.products.map((s) => s.trim().toLowerCase()));
    const chosen = catalog.filter((p) => wanted.has((p.handle ?? "").toLowerCase()) || wanted.has(p.title.toLowerCase()));
    if (!chosen.length) throw new ToolError("None of those products are in the catalog. Use handles or exact titles from match_products.");
    const matched = opts.team ? pickForTeam(chosen, opts.team.league, opts.team.team, chosen.length) : [];
    const have = new Set(matched.map((p) => p.handle));
    return [...matched, ...chosen.filter((p) => !have.has(p.handle)).map((p) => plain(p, "Your pick"))];
  }
  const picks = pickForTown(catalog, town, 3);
  const interest = opts.sport ? SPORT_INTEREST[opts.sport] : undefined;
  const more = opts.team ? pickForTeam(catalog, opts.team.league, opts.team.team, 3) : interest ? pickForInterest(catalog, interest, 3) : [];
  for (const p of more) if (!picks.some((x) => x.handle === p.handle)) picks.push(p);
  return picks.slice(0, 3);
}

export interface TownCampaignArgs {
  offer?: string;
  products?: string[];
  store_url?: string;
  currency?: string;
  radius_miles?: number;
}

/** The campaign for a hometown moment, or a sample for a town. */
export async function campaignForTown(input: {
  db: SupabaseClient;
  brand: { id: string; name: string; store_url: string | null; licensed: boolean };
  moment: MomentRow | null;
  sample?: { type: HometownType; place: Place; team: TeamRef | null };
  catalog: PickProduct[];
  counts: AreaCount[];
  args: TownCampaignArgs;
  now: Date;
}) {
  const { db, brand, moment: row, sample, now, args } = input;
  const detail = row ? (row.detail as unknown as HometownDetail) : null;
  const place = row ? (row.place_key ? await placeByKey(row.place_key) : null) : (sample?.place ?? null);
  if (!place) throw new ToolError("Walkoff can't find that moment's town anymore. Ask your Walkoff contact.");
  const label = placeLabel(place);
  const circle = await townCircle(place, { radiusMiles: args.radius_miles ?? detail?.town?.radius_miles });
  const team = row ? (teamFromFeedId(row.team_id) ?? null) : (sample?.team ?? null);
  const athletes = detail?.athletes ?? [];
  const rights = athletes.length ? await namingRights(db, brand.id, athletes.map((a) => a.id), now.toISOString().slice(0, 10)) : new Map();
  const named = athletes.find((a) => rights.has(a.id));
  const type = (row?.type ?? sample!.type) as HometownType;
  const picks = townPicks(input.catalog, place.name, { team, sport: athletes[0]?.id.split(":")[1] ?? null, products: args.products });
  const audience = townAudience(label, circle, { customers: townCustomers(circle, input.counts), lift: townLift(circle, input.counts), counts: input.counts });
  const occurredAt = row ? new Date(row.occurred_at) : now;
  const startsAt = typeof row?.detail?.startsAt === "string" ? new Date(row.detail.startsAt) : null;
  const campaign = buildHometownCampaign({
    brand: { name: brand.name, storeUrl: args.store_url ?? brand.store_url, licensed: brand.licensed },
    moment: {
      id: row?.id ?? null,
      type,
      headline: row?.headline ?? `Sample: ${typeName(type)} · ${label}`,
      occurredAt,
      gameStart: startsAt ?? (type === "hometown_contender" && !row ? new Date(now.getTime() + 20 * 3_600_000) : null),
      town: { label, name: place.name, country: place.country, region: place.region },
      team,
    },
    picks,
    audience,
    mayName: named ? { name: named.name, through: rights.get(named.id)!.endsOn } : null,
    options: { offer: args.offer, currency: args.currency?.toUpperCase(), now },
  });
  return {
    moment: {
      id: row?.id ?? null,
      type,
      type_name: typeName(type),
      headline: row?.headline ?? `Sample: ${typeName(type)} · ${label}`,
      town: label,
      team: team?.team.name ?? detail?.team?.name ?? null,
      occurred_at: occurredAt.toISOString(),
    },
    campaign,
  };
}
