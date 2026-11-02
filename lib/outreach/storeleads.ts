// Pulls the stores to pitch from the Store Leads API and writes them as a
// CSV `npm run prospects -- import` reads, so the API and the web export
// take the same road in. docs/storeleads.md has the plan, the search and
// why each filter is there.
//
// Store-level fields only: no emails, phones or social accounts.
import Papa from "papaparse";

export const API = "https://storeleads.app/json/api/v1/all/domain";

/** Between multi-value cells' values. App names hold colons
 *  ("Klaviyo: Email Marketing & SMS"), so not Store Leads' default. */
export const SEPARATOR = "|";

/** Categories whose products can come in a team's colors. Store Leads
 *  files a store under its subcategories ("/Apparel/Athletic Apparel"),
 *  so each one is named. */
export const CATEGORIES = [
  "/Apparel",
  "/Apparel/Athletic Apparel",
  "/Apparel/Casual Apparel",
  "/Apparel/Children's Clothing",
  "/Apparel/Clothing Accessories",
  "/Apparel/Eyewear",
  "/Apparel/Footwear",
  "/Apparel/Headwear",
  "/Apparel/Men's Clothing",
  "/Apparel/Swimwear",
  "/Apparel/Women's Clothing",
  "/Home & Garden/Kitchen & Dining",
  "/Home & Garden/Kitchen & Dining/Cookware & Diningware",
  "/Home & Garden/Home & Interior Decor",
  "/Home & Garden/Bed & Bath",
  "/Home & Garden/Yard & Patio",
  "/Pets & Animals/Dogs",
  "/Pets & Animals/Cats",
  "/Pets & Animals/Pet Food & Supplies",
  "/Sports/Sporting Goods",
  "/Sports/Sporting Goods/Outdoors",
  "/Sports/Sporting Goods/Hiking & Camping",
  "/Sports/Sporting Goods/Fishing",
  "/Sports/Individual Sports/Golf",
  "/Sports/Team Sports",
  "/Sports/College Sports",
  "/Travel/Bags & Luggage",
];

/** Monthly sales Store Leads estimates, in dollars: enough to run email,
 *  small enough that a founder reads cold email. */
export const SALES = { min: 25_000, max: 1_000_000 };

/** Enough products for three in a team's colors; the scorer reads 1,000. */
export const PRODUCTS = { min: 10, max: 5_000 };

/** More people than this and the founder isn't reading cold email. Store
 *  Leads knows headcount for few stores, so it's checked here, not in the
 *  search (a filter would drop every store it doesn't know). */
export const MAX_EMPLOYEES = 200;

/** The search, as List Domains request options. Values are comma-separated,
 *  with a literal comma escaped. */
export function searchParams(): Record<string, string> {
  const list = (values: string[]) => values.map((v) => v.replace(/,/g, "\\,")).join(",");
  return {
    "f:p": "shopify",
    "f:cc": "US",
    "f:ds": "Active",
    "f:an": "shopify.klaviyo-email-marketing",
    "f:cat": list(CATEGORIES),
    "f:cat:op": "or",
    // Store Leads keeps money in cents.
    "f:ermin": String(SALES.min * 100),
    "f:ermax": String(SALES.max * 100),
    "f:pcmin": String(PRODUCTS.min),
    "f:pcmax": String(PRODUCTS.max),
    // A custom domain, not shop.myshopify.com.
    "f:ismy": "false",
    "f:tags": list(["Dropshipper", "Print on Demand"]),
    "f:tags:op": "not",
  };
}

/** What the CSV needs, so pages come back small and fast. */
export const FIELDS = [
  "name",
  "merchant_name",
  "platform",
  "country_code",
  "administrative_area_level_1",
  "city",
  "postal_code",
  "latitude",
  "longitude",
  "estimated_sales",
  "product_count",
  "employee_count",
  "categories",
  "apps.name",
  "cluster_domains",
  "rank",
];

/** A Domain as the API returns it, the fields above. Note `state` is the
 *  store's status (Active), never a US state: that's
 *  administrative_area_level_1. */
export interface Domain {
  name?: string;
  merchant_name?: string;
  platform?: string;
  country_code?: string;
  administrative_area_level_1?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  /** Cents of USD a month. */
  estimated_sales?: number;
  product_count?: number;
  employee_count?: number;
  categories?: string[];
  apps?: { name?: string }[];
  cluster_domains?: string[];
  rank?: number;
}

/** The importer's columns (lib/outreach/csv.ts finds each by name). */
export const HEADERS = [
  "Domain",
  "Merchant Name",
  "Platform",
  "Country Code",
  "State",
  "City",
  "Postal Code",
  "Latitude",
  "Longitude",
  "Estimated Monthly Sales",
  "Product Count",
  "Employee Count",
  "Categories",
  "Apps",
  "Rank",
] as const;

type CsvRow = Record<(typeof HEADERS)[number], string>;

const cell = (v: string | number | undefined | null) => (v === undefined || v === null ? "" : String(v));
const joined = (values: (string | undefined)[]) =>
  values
    .map((v) => v?.replaceAll(SEPARATOR, "/").trim())
    .filter(Boolean)
    .join(SEPARATOR);

export function toRow(d: Domain): CsvRow {
  return {
    Domain: cell(d.name),
    "Merchant Name": cell(d.merchant_name),
    Platform: cell(d.platform),
    "Country Code": cell(d.country_code),
    State: cell(d.administrative_area_level_1),
    City: cell(d.city),
    "Postal Code": cell(d.postal_code),
    Latitude: cell(d.latitude),
    Longitude: cell(d.longitude),
    // Cents to dollars: the importer reads dollars.
    "Estimated Monthly Sales": typeof d.estimated_sales === "number" ? (d.estimated_sales / 100).toFixed(2) : "",
    "Product Count": cell(d.product_count),
    "Employee Count": cell(d.employee_count),
    Categories: joined(d.categories ?? []),
    Apps: joined((d.apps ?? []).map((a) => a.name)),
    Rank: cell(d.rank),
  };
}

const bare = (domain: string) => domain.trim().toLowerCase().replace(/^www\./, "");

export interface Kept {
  domains: Domain[];
  /** Domains left out, by reason. */
  dropped: Record<string, number>;
}

/** One domain per merchant (the first, so the best ranked when sorted by
 *  rank), only US stores, and none bigger than a founder-run team. */
export function keep(domains: Domain[]): Kept {
  const seen = new Set<string>();
  const out: Domain[] = [];
  const dropped: Record<string, number> = {};
  const drop = (reason: string) => (dropped[reason] = (dropped[reason] ?? 0) + 1);
  for (const d of domains) {
    if (!d.name) {
      drop("no domain");
      continue;
    }
    const name = bare(d.name);
    if (seen.has(name)) {
      drop("same merchant's other domain");
      continue;
    }
    if (d.country_code && d.country_code.toUpperCase() !== "US") {
      drop("not in the US");
      continue;
    }
    if (typeof d.employee_count === "number" && d.employee_count > MAX_EMPLOYEES) {
      drop(`more than ${MAX_EMPLOYEES} employees`);
      continue;
    }
    for (const c of [name, ...(d.cluster_domains ?? []).map(bare)]) seen.add(c);
    out.push(d);
  }
  return { domains: out, dropped };
}

export function toCsv(domains: Domain[]): string {
  return Papa.unparse({ fields: [...HEADERS], data: domains.map((d) => HEADERS.map((h) => toRow(d)[h])) });
}

// ── The API ─────────────────────────────────────────────────────────

export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export interface PullOptions {
  key: string;
  /** A saved search's List id: pull that list instead of the search above. */
  list?: string;
  /** Stop after this many domains. */
  max?: number;
  pageSize?: number;
  fetch?: Fetch;
  /** Between pages. List Domains allows 2 requests a second on Pro. */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onPage?: (got: number, total: number | null) => void;
}

export interface Page {
  domains?: Domain[];
  next_cursor?: string;
  has_next_page?: boolean;
  total?: number;
}

export class StoreLeadsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The request URL for one page. */
export function pageUrl(opts: { list?: string; pageSize: number; cursor?: string }): string {
  const params = new URLSearchParams(opts.list ? { "f:lids": opts.list } : searchParams());
  params.set("fields", FIELDS.join(","));
  params.set("sort", "rank");
  params.set("page_size", String(opts.pageSize));
  if (opts.cursor) params.set("cursor", opts.cursor);
  return `${API}?${params}`;
}

/** One page, waiting out a 429 as its Retry-After says. */
async function getPage(url: string, opts: PullOptions): Promise<Page> {
  const fetcher = opts.fetch ?? ((u, i) => fetch(u, i));
  const sleep = opts.sleep ?? wait;
  for (let attempt = 0; ; attempt++) {
    const res = await fetcher(url, { headers: { Authorization: `Bearer ${opts.key}`, Accept: "application/json" } });
    if (res.status === 429 && attempt < 5) {
      const seconds = Number(res.headers.get("retry-after"));
      await sleep((Number.isFinite(seconds) && seconds > 0 ? seconds : 2 ** attempt) * 1000);
      continue;
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      const why =
        res.status === 401 ? "the key was refused (check STORELEADS_API_KEY)"
        : res.status === 403 ? "this plan has no API access (it takes Pro or higher)"
        : res.status === 429 ? "still rate limited after 5 tries"
        : `HTTP ${res.status}`;
      throw new StoreLeadsError(`Store Leads: ${why}. ${body}`.trim(), res.status);
    }
    return (await res.json()) as Page;
  }
}

/** How many stores the search matches, from one small page. */
export async function countMatches(opts: PullOptions): Promise<number | null> {
  const page = await getPage(pageUrl({ list: opts.list, pageSize: 1 }), opts);
  return typeof page.total === "number" ? page.total : null;
}

/** Every domain the search matches (up to max), page by page. A cursor
 *  dies at the weekly data update, so a pull is one sitting. */
export async function pullDomains(opts: PullOptions): Promise<{ domains: Domain[]; total: number | null }> {
  const pageSize = Math.min(opts.pageSize ?? 1000, 5000, opts.max ?? Infinity);
  const sleep = opts.sleep ?? wait;
  const domains: Domain[] = [];
  let total: number | null = null;
  let cursor: string | undefined;
  do {
    if (cursor) await sleep(opts.pauseMs ?? 600);
    const page = await getPage(pageUrl({ list: opts.list, pageSize, cursor }), opts);
    if (typeof page.total === "number") total = page.total;
    domains.push(...(page.domains ?? []));
    opts.onPage?.(domains.length, total);
    cursor = page.has_next_page === false ? undefined : page.next_cursor;
  } while (cursor && domains.length < (opts.max ?? Infinity));
  return { domains: opts.max ? domains.slice(0, opts.max) : domains, total };
}
