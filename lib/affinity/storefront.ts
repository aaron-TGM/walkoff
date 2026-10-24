// Reads a Shopify store's catalog from its public product feed
// (/products.json, 250 products a page): what the store already shows
// shoppers, and no customer data. Each product becomes the rows a Shopify
// product export has, so parseCatalog reads the feed exactly as it reads an
// upload. import_catalog (lib/mcp/tools.ts) saves the result.
import { FetchRefused, publicGet, type Lookup } from "../public-fetch";
import { parseCatalog, type CatalogItem, type Row } from "./imports";

export const STOREFRONT = {
  pageSize: 250,
  /** 20 pages is 5,000 products, the most one catalog import takes. */
  maxPages: 20,
  pageTimeoutMs: 10_000,
  maxPageBytes: 16 * 2 ** 20,
  /** Reading stops in time to save inside the MCP route's 60 seconds. */
  budgetMs: 25_000,
  maxRedirects: 3,
  userAgent: "Walkoff/1.0 (+https://www.walkoff.io/help/shopify)",
} as const;

/** A product as Shopify's products.json has it. */
export interface FeedProduct {
  id?: number;
  handle?: string;
  title?: string;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  options?: { name?: string; position?: number }[];
  variants?: {
    sku?: string | null;
    price?: string | number | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    featured_image?: { src?: string } | null;
  }[];
  images?: { src?: string }[];
}

/** Why a store's catalog couldn't be read, in words for the marketer. */
export class StorefrontError extends Error {}

/** "//cdn.shopify.com/x.jpg" -> "https://cdn.shopify.com/x.jpg". */
const https = (src?: string | null) => (src ? (src.startsWith("//") ? `https:${src}` : src) : undefined);

/** The rows a Shopify product export would have for these products: the
 *  product's details on its first row, then a row per variant. */
export function productsJsonToRows(products: FeedProduct[]): Row[] {
  const rows: Row[] = [];
  for (const p of products) {
    if (!p.title) continue;
    const handle = p.handle || String(p.id ?? p.title);
    const first: Row = {
      Handle: handle,
      Title: p.title,
      "Body (HTML)": p.body_html ?? undefined,
      Type: p.product_type ?? undefined,
      Tags: Array.isArray(p.tags) ? p.tags.join(", ") : (p.tags ?? undefined),
      "Image Src": https(p.images?.[0]?.src),
    };
    (p.options ?? []).forEach((o, i) => {
      const n = o.position ?? i + 1;
      if (o.name && n >= 1 && n <= 3) first[`Option${n} Name`] = o.name;
    });
    const variants = p.variants?.length ? p.variants : [{}];
    variants.forEach((v: NonNullable<FeedProduct["variants"]>[number], i) => {
      const row: Row = i === 0 ? first : { Handle: handle };
      row["Option1 Value"] = v.option1 ?? undefined;
      row["Option2 Value"] = v.option2 ?? undefined;
      row["Option3 Value"] = v.option3 ?? undefined;
      row["Variant SKU"] = v.sku ?? undefined;
      row["Variant Price"] = v.price === null || v.price === undefined ? undefined : String(v.price);
      row["Variant Image"] = https(v.featured_image?.src);
      rows.push(row);
    });
  }
  return rows;
}

export interface StorefrontCatalog {
  /** The store's address, after any redirect. */
  origin: string;
  items: CatalogItem[];
  pages: number;
  /** False when reading stopped early. What was read is still worth saving. */
  complete: boolean;
  note?: string;
}

interface ReadOptions {
  fetch?: typeof fetch;
  lookup?: Lookup;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  maxPages?: number;
  budgetMs?: number;
}

type Page = { ok: true; products: FeedProduct[]; url: string } | { ok: false; error: StorefrontError };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const count = (n: number) => n.toLocaleString("en-US");

const fail = (message: string): Page => ({ ok: false, error: new StorefrontError(message) });

/** One page of the feed, tried twice when the store is busy or slow. */
async function readPage(origin: string, host: string, page: number, o: ReadOptions): Promise<Page> {
  const url = `${origin}/products.json?limit=${STOREFRONT.pageSize}&page=${page}`;
  let retryIn = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await (o.sleep ?? wait)(retryIn);
    const last = attempt === 1;
    let res;
    try {
      res = await publicGet(url, {
        fetch: o.fetch,
        lookup: o.lookup,
        timeoutMs: STOREFRONT.pageTimeoutMs,
        maxBytes: STOREFRONT.maxPageBytes,
        maxRedirects: STOREFRONT.maxRedirects,
        headers: { Accept: "application/json", "User-Agent": STOREFRONT.userAgent },
      });
    } catch (err) {
      if (!(err instanceof FetchRefused)) throw err;
      if ((err.reason === "network" || err.reason === "timeout") && !last) {
        retryIn = 1000;
        continue;
      }
      if (err.reason === "timeout") return fail(`${host} took too long to answer. Try again in a few minutes.`);
      if (err.reason === "network") return fail(`Walkoff couldn't reach ${host}. Try again in a few minutes.`);
      if (err.reason === "unresolved") return fail(`Walkoff couldn't find ${host}. Check the store's address.`);
      if (err.reason === "too_big") return fail(`${host}'s product feed is too big to read.`);
      if (err.reason === "redirects") return fail(`${host} redirected too many times.`);
      return fail(`Walkoff can only read stores on the public internet, and ${host} isn't one.`);
    }
    if (new URL(res.url).pathname.startsWith("/password")) {
      return fail(`${host} is password protected, so its products aren't public yet.`);
    }
    // 430 is Shopify turning away traffic it takes for a bot.
    if ((res.status === 429 || res.status === 430 || res.status >= 500) && !last) {
      retryIn = Math.min(Number(res.retryAfter) * 1000 || 1000, 2000);
      continue;
    }
    if (res.status === 429 || res.status >= 500) return fail(`${host} is busy right now. Try again in a few minutes.`);
    if (res.status === 401 || res.status === 403 || res.status === 430) {
      return fail(`${host} turned Walkoff away (HTTP ${res.status}).`);
    }
    let body: unknown = null;
    try {
      body = res.status === 200 ? JSON.parse(res.text) : null;
    } catch {
      body = null;
    }
    const products = (body as { products?: unknown } | null)?.products;
    if (!Array.isArray(products)) return fail(`${host} doesn't have a Shopify product feed, so it may not be a Shopify store.`);
    return { ok: true, products: products as FeedProduct[], url: res.url };
  }
  return fail(`${host} is busy right now. Try again in a few minutes.`);
}

/** Every product in the store's public feed, up to 20 pages. Throws a
 *  StorefrontError when the first page can't be read; a later page that
 *  fails ends the read early, with a note. */
export async function fetchStorefrontCatalog(storeUrl: string, o: ReadOptions = {}): Promise<StorefrontCatalog> {
  const now = o.now ?? Date.now;
  const started = now();
  const maxPages = o.maxPages ?? STOREFRONT.maxPages;
  const budget = o.budgetMs ?? STOREFRONT.budgetMs;
  let origin: string;
  try {
    origin = new URL(storeUrl).origin;
  } catch {
    throw new StorefrontError(`${storeUrl} isn't a store address.`);
  }
  const host = new URL(origin).host;
  const seen = new Set<string>();
  const products: FeedProduct[] = [];
  let pages = 0;
  let complete = false;
  let note: string | undefined;

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1 && now() - started > budget) {
      note = `Walkoff stopped after ${pages} pages to stay within time, so products past the first ${count(products.length)} weren't read.`;
      break;
    }
    const read = await readPage(origin, host, page, o);
    if (!read.ok) {
      if (page === 1) throw read.error;
      note = `${read.error.message} Walkoff read the first ${count(products.length)} products.`;
      break;
    }
    // After a redirect (say, to www), read the rest from where the store lives.
    if (page === 1) origin = new URL(read.url).origin;
    pages++;
    for (const p of read.products) {
      const key = String(p.id ?? p.handle ?? p.title);
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(p);
    }
    if (read.products.length < STOREFRONT.pageSize) {
      complete = true;
      break;
    }
    if (page === maxPages) {
      note = `The store has more than ${count(maxPages * STOREFRONT.pageSize)} products. Walkoff read the first ${count(products.length)}.`;
    }
  }

  const items = parseCatalog("shopify_products", productsJsonToRows(products));
  if (!items.length) throw new StorefrontError(`${host}'s product feed has no products.`);
  return { origin, items, pages, complete, ...(note ? { note } : {}) };
}
