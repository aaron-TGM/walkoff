// Brands and the people who use Walkoff for them, shared by the brand script
// (npm run brand) and the operator tools in Claude (lib/mcp/tools.ts).
// Tables: supabase/004 (brands, uploads, catalogs, reports) and 006 (members,
// sign-ins, triggers, sends).
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FORMAT_LABEL, formatKind, type ImportFormat } from "./affinity/imports";
import { catalogStats } from "./affinity/store";
import { resourceOf } from "./mcp/oauth/config";
import { liveGrants } from "./mcp/oauth/store";
import type { Welcome } from "./welcome";

/** A problem the person can fix, said in words they can act on. */
export class BrandError extends Error {}

export interface BrandRecord {
  id: string;
  name: string;
  /** The secret in the brand's upload link. */
  upload_token: string;
  contact_email: string | null;
  store_url: string | null;
  licensed: boolean;
  created_at: string;
}

/** A brand already has the name. Callers say how to go ahead anyway. */
export class DuplicateBrand extends BrandError {
  existing: BrandRecord[];
  constructor(existing: BrandRecord[]) {
    const which = existing.map((b) => `id ${b.id}, created ${b.created_at.slice(0, 10)}`).join("; ");
    super(`A brand named ${existing[0].name} already exists (${which}).`);
    this.existing = existing;
  }
}

const COLUMNS = "id, name, upload_token, contact_email, store_url, licensed, created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATALOG_FORMATS = (Object.keys(FORMAT_LABEL) as ImportFormat[]).filter((f) => formatKind(f) === "catalog");

// ── Values ─────────────────────────────────────────────────────────

export const newUploadToken = () => randomBytes(18).toString("base64url");

/** Where links point outside a request (the scripts): WALKOFF_PUBLIC_URL,
 *  else www.walkoff.io. Connectors need the www address. */
export const siteOrigin = () => (process.env.WALKOFF_PUBLIC_URL?.trim() || "https://www.walkoff.io").replace(/\/+$/, "");

export const uploadLink = (token: string, origin = siteOrigin()) => `${origin.replace(/\/+$/, "")}/upload/${token}`;

export function brandName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new BrandError("Give the brand a name.");
  if (name.length > 100) throw new BrandError("Keep the brand's name to 100 characters.");
  return name;
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** The store's https origin, from "frostbuddy.com" or any link on it. */
export function storeOrigin(raw: string): string {
  const s = raw.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new BrandError(`${s || "That"} isn't a web address.`);
  }
  if (url.protocol !== "https:") throw new BrandError("The store address must be https.");
  if (!url.hostname.includes(".") || url.username || url.password) throw new BrandError(`${s} isn't a web address.`);
  return url.origin;
}

/** Emails are stored lowercase (brand_members checks). */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BrandError(`${raw.trim() || "That"} isn't an email address.`);
  return email;
}

// ── Brands ─────────────────────────────────────────────────────────

export async function listBrands(db: SupabaseClient): Promise<BrandRecord[]> {
  const { data, error } = await db.from("brands").select(COLUMNS).order("created_at");
  if (error) throw error;
  return (data ?? []) as BrandRecord[];
}

export async function brandRecord(db: SupabaseClient, id: string): Promise<BrandRecord | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db.from("brands").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as BrandRecord | null) ?? null;
}

/** Brands with this name, ignoring case and spacing. Compared here rather
 *  than with ilike, where % and _ are wildcards. */
export async function brandsNamed(db: SupabaseClient, name: string): Promise<BrandRecord[]> {
  const key = nameKey(name);
  return (await listBrands(db)).filter((b) => nameKey(b.name) === key);
}

/** A brand by id, upload token or name, for the scripts. */
export async function resolveBrand(db: SupabaseClient, ref: string | undefined): Promise<BrandRecord> {
  const r = ref?.trim();
  if (!r) throw new BrandError("Which brand? Pass its name, id or upload token.");
  const all = await listBrands(db);
  const byKey = all.find((b) => b.id === r.toLowerCase() || b.upload_token === r);
  if (byKey) return byKey;
  const named = all.filter((b) => nameKey(b.name) === nameKey(r));
  if (named.length === 1) return named[0];
  throw new BrandError(named.length ? `More than one brand is named ${r}; use its id.` : `No brand named ${r}.`);
}

export interface NewBrand {
  name: string;
  storeUrl?: string | null;
  licensed?: boolean;
  contactEmail?: string | null;
  /** Create it even though a brand has the name already. */
  allowDuplicate?: boolean;
}

export async function createBrand(db: SupabaseClient, b: NewBrand): Promise<BrandRecord> {
  const row = {
    name: brandName(b.name),
    upload_token: newUploadToken(),
    contact_email: b.contactEmail?.trim() ? normalizeEmail(b.contactEmail) : null,
    store_url: b.storeUrl?.trim() ? storeOrigin(b.storeUrl) : null,
    licensed: b.licensed ?? false,
  };
  if (!b.allowDuplicate) {
    const same = await brandsNamed(db, row.name);
    if (same.length) throw new DuplicateBrand(same);
  }
  const { data, error } = await db.from("brands").insert(row).select(COLUMNS).single();
  if (error) throw error;
  return data as BrandRecord;
}

export interface BrandChanges {
  name?: string;
  storeUrl?: string;
  licensed?: boolean;
  /** A new upload token: the old link stops working. */
  newUploadLink?: boolean;
}

export async function updateBrand(db: SupabaseClient, id: string, c: BrandChanges): Promise<BrandRecord> {
  const changes: Record<string, unknown> = {};
  if (c.name !== undefined) {
    const name = brandName(c.name);
    const other = (await brandsNamed(db, name)).find((b) => b.id !== id);
    if (other) throw new BrandError(`Another brand is already named ${other.name}. Pick a different name.`);
    changes.name = name;
  }
  if (c.storeUrl !== undefined) changes.store_url = storeOrigin(c.storeUrl);
  if (c.licensed !== undefined) changes.licensed = c.licensed;
  if (c.newUploadLink) changes.upload_token = newUploadToken();
  if (!Object.keys(changes).length) throw new BrandError("Nothing to change.");
  const { data, error } = await db.from("brands").update(changes).eq("id", id).select(COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new BrandError("That brand doesn't exist.");
  return data as BrandRecord;
}

// ── Members ────────────────────────────────────────────────────────

export interface Member {
  email: string;
  invited_at: string;
  /** Has a sign-in in Claude that reaches this brand. */
  connected: boolean;
  /** Signed in before this invite, so has to connect again to reach it. */
  needs_reconnect?: true;
}

type Grants = Awaited<ReturnType<typeof liveGrants>>;

function connection(grants: Grants, email: string, brandId: string): Pick<Member, "connected" | "needs_reconnect"> {
  const mine = grants.filter((g) => g.email === email);
  if (mine.some((g) => g.brand_ids === null || g.brand_ids.includes(brandId))) return { connected: true };
  return mine.length ? { connected: false, needs_reconnect: true } : { connected: false };
}

/** Lets someone connect Walkoff for the brand. added is false when they
 *  already could. */
export async function addMember(db: SupabaseClient, brandId: string, rawEmail: string): Promise<{ email: string; added: boolean }> {
  const email = normalizeEmail(rawEmail);
  const { data, error } = await db
    .from("brand_members")
    .upsert({ brand_id: brandId, email }, { onConflict: "brand_id,email", ignoreDuplicates: true })
    .select("email");
  if (error) throw error;
  return { email, added: (data ?? []).length > 0 };
}

/** Their access in Claude ends on their next request (principalFor checks
 *  again). The brand's upload link doesn't change: updateBrand replaces it. */
export async function removeMember(db: SupabaseClient, brandId: string, rawEmail: string): Promise<{ email: string; removed: boolean }> {
  const email = normalizeEmail(rawEmail);
  const { data, error } = await db.from("brand_members").delete().eq("brand_id", brandId).eq("email", email).select("email");
  if (error) throw error;
  return { email, removed: (data ?? []).length > 0 };
}

export async function listMembers(db: SupabaseClient, brandId: string, now = new Date()): Promise<Member[]> {
  const { data, error } = await db.from("brand_members").select("email, created_at").eq("brand_id", brandId).order("created_at");
  if (error) throw error;
  const rows = (data ?? []) as { email: string; created_at: string }[];
  const grants = await liveGrants(db, rows.map((m) => m.email), now);
  return rows.map((m) => ({ email: m.email, invited_at: m.created_at, ...connection(grants, m.email, brandId) }));
}

/** The welcome email for someone just invited to the brand. The upload
 *  link in it is the brand's secret: only send it to members. */
export async function welcomeFor(
  db: SupabaseClient,
  brand: BrandRecord,
  email: string,
  opts: { invitedBy?: string | null; origin?: string; now?: Date } = {},
): Promise<Welcome> {
  const origin = opts.origin ?? siteOrigin();
  const grants = await liveGrants(db, [email], opts.now);
  return {
    to: email,
    brand: brand.name,
    invitedBy: opts.invitedBy ?? null,
    uploadUrl: uploadLink(brand.upload_token, origin),
    connectorUrl: resourceOf(origin),
    reconnect: !!connection(grants, email, brand.id).needs_reconnect,
  };
}

// ── Onboarding ─────────────────────────────────────────────────────

export interface OnboardingStatus {
  brand: string;
  id: string;
  created_at: string;
  store_url: string | null;
  licensed: boolean;
  members: Member[];
  /** The latest customer or order upload. */
  customers: { uploaded: number | null; file: string; at: string } | null;
  /** The latest affinity map. */
  map: { customers_mapped: number; not_placed: number; standout_teams: string[]; computed_at: string } | null;
  catalog: {
    products: number;
    colorways: number;
    tagged_to_a_team: number;
    tagged_by_claude: number;
    tagged_by_rules: number;
    claude_share: number;
    uploaded_at: string | null;
  };
  triggers: { active: number; total: number };
  /** The latest campaign drafted or sent. */
  last_send: { status: string; at: string; moment: string | null } | null;
  next: string;
}

async function count(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

async function latestUpload(db: SupabaseClient, brandId: string, kind: "customers" | "catalog") {
  let q = db.from("brand_uploads").select("format, customers, created_at").eq("brand_id", brandId);
  q = kind === "catalog" ? q.in("format", CATALOG_FORMATS) : q.not("format", "in", `(${CATALOG_FORMATS.join(",")})`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as { format: ImportFormat; customers: number | null; created_at: string } | null;
}

/** The latest map's totals and standouts, without the rest of the report. */
async function latestMap(db: SupabaseClient, brandId: string) {
  const { data, error } = await db
    .from("affinity_reports")
    .select("created_at, totals:report->totals, standouts:report->standouts")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as {
    created_at: string;
    totals: { matchedCustomers?: number; unmatchedCustomers?: number } | null;
    standouts: { teamName?: string; leagueName?: string }[] | null;
  } | null;
}

async function lastSend(db: SupabaseClient, brandId: string): Promise<OnboardingStatus["last_send"]> {
  const { data, error } = await db
    .from("sends")
    .select("status, created_at, moment_id")
    .eq("brand_id", brandId)
    .in("status", ["drafted", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const moment = await db.from("moments").select("headline").eq("id", data.moment_id).maybeSingle();
  if (moment.error) throw moment.error;
  return { status: data.status as string, at: data.created_at as string, moment: (moment.data?.headline as string | undefined) ?? null };
}

/** Where a brand is in onboarding, and what to do next. */
export async function onboardingStatus(db: SupabaseClient, brandId: string, now = new Date()): Promise<OnboardingStatus> {
  const brand = await brandRecord(db, brandId);
  if (!brand) throw new BrandError("That brand doesn't exist.");
  const products = () => db.from("brand_products").select("handle", { count: "exact", head: true }).eq("brand_id", brandId);
  const [members, customers, catalogUpload, map, stats, byClaude, triggers, send] = await Promise.all([
    listMembers(db, brandId, now),
    latestUpload(db, brandId, "customers"),
    latestUpload(db, brandId, "catalog"),
    latestMap(db, brandId),
    catalogStats(db, brandId),
    count(products().eq("tagged_by", "claude")),
    db.from("triggers").select("active").eq("brand_id", brandId),
    lastSend(db, brandId),
  ]);
  if (triggers.error) throw triggers.error;
  const status: Omit<OnboardingStatus, "next"> = {
    brand: brand.name,
    id: brand.id,
    created_at: brand.created_at,
    store_url: brand.store_url,
    licensed: brand.licensed,
    members,
    customers: customers
      ? { uploaded: customers.customers, file: FORMAT_LABEL[customers.format] ?? customers.format, at: customers.created_at }
      : null,
    map: map
      ? {
          customers_mapped: map.totals?.matchedCustomers ?? 0,
          not_placed: map.totals?.unmatchedCustomers ?? 0,
          standout_teams: (map.standouts ?? []).filter((g) => g.teamName).map((g) => (g.leagueName ? `${g.teamName} (${g.leagueName})` : g.teamName!)),
          computed_at: map.created_at,
        }
      : null,
    catalog: {
      products: stats.products,
      colorways: stats.colorways,
      tagged_to_a_team: stats.tagged,
      tagged_by_claude: byClaude,
      tagged_by_rules: stats.products - byClaude,
      claude_share: stats.products ? Math.round((byClaude / stats.products) * 100) / 100 : 0,
      uploaded_at: catalogUpload?.created_at ?? null,
    },
    triggers: { active: (triggers.data ?? []).filter((t) => t.active).length, total: (triggers.data ?? []).length },
    last_send: send,
  };
  return { ...status, next: nextStep(status) };
}

const and = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** The one thing that moves the brand along, in the order onboarding goes:
 *  the operator's setup, the brand's uploads, Claude's tagging, connecting
 *  Claude, then a first campaign. */
export function nextStep(s: Omit<OnboardingStatus, "next">): string {
  const emails = s.members.map((m) => m.email);
  if (!s.store_url) return "Add the store's address with update_brand, so campaigns link to its products.";
  if (!emails.length) return "Invite the brand's marketer with invite_member. It emails them the upload link and how to connect Walkoff in Claude.";
  if (!s.customers) return `Waiting on ${and(emails)} to upload customers or orders (step 1 on the upload page). invite_member sends the welcome email again.`;
  if (!s.map?.customers_mapped) return "The customer upload didn't place anyone in a postal area. Ask the brand for an export with shipping addresses.";
  if (!s.catalog.products) return "Waiting on the product export (step 2 on the upload page).";
  if (s.catalog.tagged_by_rules) {
    const n = s.catalog.tagged_by_rules;
    return `Tag the catalog with Claude: npm run affinity:tag -- --brand ${s.id}. ${n} ${n === 1 ? "product has" : "products have"} only rule-based tags.`;
  }
  if (!s.members.some((m) => m.connected)) {
    const again = s.members.filter((m) => m.needs_reconnect).map((m) => m.email);
    return again.length
      ? `${and(again)} signed in before this invite, so they need to disconnect Walkoff in Claude and connect it again to reach ${s.brand}.`
      : `Waiting on ${and(emails)} to connect Walkoff in Claude. The steps are in the welcome email.`;
  }
  if (!s.last_send) return "Ready for a first campaign. trigger_queue shows the moments to act on now.";
  return `Live. The last campaign was ${s.last_send.status} on ${s.last_send.at.slice(0, 10)}.`;
}
