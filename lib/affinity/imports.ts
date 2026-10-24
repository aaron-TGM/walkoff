// Turns a brand's export files into the counts Walkoff stores. Runs in the
// brand's browser (app/upload), so names, emails and addresses never leave
// their computer: only postal-area counts and product names do. parseCatalog
// also reads a Shopify store's public product feed on the server
// (storefront.ts), so the feed and the export parse alike.
import type { AreaCount, ProductCount } from "./compute";
import { toPostalArea } from "./geo";

export type Row = Record<string, string | undefined>;

export type ImportFormat =
  | "shopify_customers"
  | "shopify_orders"
  | "klaviyo_profiles"
  | "counts_csv"
  | "shopify_products"
  | "catalog_csv";

export const FORMAT_LABEL: Record<ImportFormat, string> = {
  shopify_customers: "Shopify customer export",
  shopify_orders: "Shopify order export",
  klaviyo_profiles: "Klaviyo profile export",
  counts_csv: "Spreadsheet of counts",
  shopify_products: "Shopify product export",
  catalog_csv: "Product spreadsheet",
};

/** Data that reaches Walkoff without a file: the store's public product
 *  feed, which Walkoff reads, and customer counts from Shopify's analytics,
 *  which Claude reads with the brand's Shopify connector. */
export type ConnectorSource = "shopify_store" | "shopify_analytics";

/** Every way data reaches Walkoff, as brand_uploads.format records it. */
export type DataSource = ImportFormat | ConnectorSource;

export const SOURCE_LABEL: Record<DataSource, string> = {
  ...FORMAT_LABEL,
  shopify_store: "Shopify store feed, read by Walkoff",
  shopify_analytics: "Shopify analytics, through Claude",
};

/** Customers and orders feed the affinity map; products feed product
 *  matching. */
export function formatKind(format: DataSource): "customers" | "catalog" {
  return format === "shopify_products" || format === "catalog_csv" || format === "shopify_store" ? "catalog" : "customers";
}

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** First column whose normalized name is in `names`. */
function pick(row: Row, names: string[]): string {
  for (const key of Object.keys(row)) {
    if (names.includes(norm(key))) {
      const v = row[key]?.trim();
      if (v) return v;
    }
  }
  return "";
}

function has(headers: string[], ...names: string[]): boolean {
  const set = new Set(headers.map(norm));
  return names.every((n) => set.has(n));
}

export function detectFormat(headers: string[]): ImportFormat | null {
  const h = headers.map(norm);
  const any = (...names: string[]) => names.some((n) => h.includes(n));
  if (has(headers, "lineitem name") && any("shipping zip", "billing zip")) return "shopify_orders";
  if (has(headers, "handle", "title") && any("variant price", "body html", "type")) return "shopify_products";
  if (any("default address zip") || (has(headers, "total orders", "total spent") && any("zip"))) {
    return "shopify_customers";
  }
  if (any("zip code") && any("email", "phone number")) return "klaviyo_profiles";
  if (any("postal code", "zip", "zipcode", "postcode", "area") && any("customers", "count")) return "counts_csv";
  if (any("title", "product", "name") && any("type", "category", "tags", "product type")) return "catalog_csv";
  return null;
}

function money(v: string): number {
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** "Bird Gang Hoodie - Large / Midnight Green" -> "Bird Gang Hoodie". */
export function productName(lineItem: string): string {
  return lineItem.split(" - ")[0].trim().slice(0, 120);
}

export interface CustomerImport {
  format: ImportFormat;
  areas: AreaCount[];
  products: ProductCount[];
  /** Rows (customers, profiles or orders) read from the file. */
  rows: number;
  /** Rows without a postal code we could place. */
  skipped: number;
}

const ZIP = ["default address zip", "zip", "zip code", "postal code", "postcode", "zipcode", "area"];
const COUNTRY = ["default address country code", "country code", "country"];

/** Most products an orders upload keeps by name; the rest become "Other". */
export const MAX_PRODUCTS = 150;

export function aggregateCustomers(format: ImportFormat, rows: Row[]): CustomerImport {
  const areas = new Map<string, AreaCount>();
  const products = new Map<string, ProductCount>();
  let skipped = 0;

  const area = (zip: string, country: string) => {
    const a = toPostalArea(zip, country || null);
    if (!a) return null;
    const key = `${a.country}:${a.code}`;
    let c = areas.get(key);
    if (!c) {
      c = { country: a.country, area: a.code, customers: 0, orders: 0, revenue: 0 };
      areas.set(key, c);
    }
    return c;
  };

  if (format === "shopify_orders") {
    // One row per line item; order fields only on each order's first row.
    const orders = new Map<string, { zip: string; country: string; buyer: string; total: number; items: Map<string, number> }>();
    for (const row of rows) {
      const id = pick(row, ["name", "id"]);
      if (!id) continue;
      let o = orders.get(id);
      if (!o) {
        o = { zip: "", country: "", buyer: "", total: 0, items: new Map() };
        orders.set(id, o);
      }
      o.zip ||= pick(row, ["shipping zip", "billing zip"]);
      o.country ||= pick(row, ["shipping country", "billing country"]);
      o.buyer ||= pick(row, ["email"]).toLowerCase();
      o.total ||= money(pick(row, ["total"]));
      const item = pick(row, ["lineitem name"]);
      if (item) {
        const qty = Number(pick(row, ["lineitem quantity"])) || 1;
        const name = productName(item);
        o.items.set(name, (o.items.get(name) ?? 0) + qty * money(pick(row, ["lineitem price"])));
      }
    }

    const buyers = new Map<string, Set<string>>();
    const productOrders = new Map<string, number>();
    for (const o of orders.values()) for (const name of o.items.keys()) productOrders.set(name, (productOrders.get(name) ?? 0) + 1);
    const keep = new Set(
      [...productOrders.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_PRODUCTS).map(([n]) => n),
    );

    for (const [id, o] of orders) {
      const c = area(o.zip, o.country);
      if (!c) {
        skipped++;
        continue;
      }
      c.orders = (c.orders ?? 0) + 1;
      c.revenue = (c.revenue ?? 0) + o.total;
      const key = `${c.country}:${c.area}`;
      const set = buyers.get(key) ?? new Set<string>();
      set.add(o.buyer || id); // no email: count the order as its own buyer
      buyers.set(key, set);
      for (const [name, revenue] of o.items) {
        const product = keep.has(name) ? name : "Other";
        const pkey = `${key}:${product}`;
        const p = products.get(pkey) ?? { country: c.country, area: c.area, product, orders: 0, revenue: 0 };
        p.orders += 1;
        p.revenue = (p.revenue ?? 0) + revenue;
        products.set(pkey, p);
      }
    }
    for (const [key, set] of buyers) areas.get(key)!.customers = set.size;
    return { format, areas: finishAreas(areas), products: [...products.values()].map(roundProduct), rows: orders.size, skipped };
  }

  for (const row of rows) {
    if (format === "counts_csv") {
      const c = area(pick(row, ZIP), pick(row, COUNTRY));
      if (!c) {
        skipped++;
        continue;
      }
      c.customers += Number(pick(row, ["customers", "count"])) || 0;
      c.orders = (c.orders ?? 0) + (Number(pick(row, ["orders"])) || 0);
      c.revenue = (c.revenue ?? 0) + money(pick(row, ["revenue", "sales", "total"]));
      continue;
    }
    // One row per customer or profile.
    const c = area(pick(row, ZIP), pick(row, COUNTRY));
    if (!c) {
      skipped++;
      continue;
    }
    c.customers += 1;
    c.orders = (c.orders ?? 0) + (Number(pick(row, ["total orders"])) || 0);
    c.revenue = (c.revenue ?? 0) + money(pick(row, ["total spent"]));
  }
  return { format, areas: finishAreas(areas), products: [], rows: rows.length, skipped };
}

function finishAreas(areas: Map<string, AreaCount>): AreaCount[] {
  return [...areas.values()]
    .filter((a) => a.customers > 0)
    .map((a) => ({ ...a, revenue: Math.round((a.revenue ?? 0) * 100) / 100 }))
    .sort((a, b) => b.customers - a.customers);
}

function roundProduct(p: ProductCount): ProductCount {
  return { ...p, revenue: Math.round((p.revenue ?? 0) * 100) / 100 };
}

export interface Colorway {
  /** The brand's name for the color: "Azure Heather". */
  name: string;
  skus: string[];
  /** The variant's photo, or the product's first photo. */
  image: string;
}

export interface CatalogItem {
  handle: string;
  title: string;
  productType: string;
  category: string;
  tags: string[];
  description: string;
  price: number | null;
  /** The colors it comes in, from the variants' color option. */
  colorways: Colorway[];
}

export const MAX_COLORWAYS = 40;
export const MAX_SKUS = 60;
const COLOR_OPTION = /colou?r|shade/i;

function addColorway(item: CatalogItem, name: string, sku: string, image: string) {
  const key = name.toLowerCase();
  let cw = item.colorways.find((c) => c.name.toLowerCase() === key);
  if (!cw) {
    if (item.colorways.length >= MAX_COLORWAYS) return;
    cw = { name: name.slice(0, 60), skus: [], image: "" };
    item.colorways.push(cw);
  }
  if (sku && !cw.skus.includes(sku) && cw.skus.length < MAX_SKUS) cw.skus.push(sku.slice(0, 80));
  cw.image ||= image;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Products from a Shopify product export (one row per variant) or a plain
 *  spreadsheet (one row per product, or per color with a color column). */
export function parseCatalog(format: ImportFormat, rows: Row[]): CatalogItem[] {
  const items = new Map<string, CatalogItem>();
  // Shopify names a product's options on its first row only.
  const colorOption = new Map<string, number>();
  const firstImage = new Map<string, string>();
  const skus = new Map<string, string[]>();
  // Shopify's standard color field ("Blue; Yellow"), for one-color products.
  const fieldColors = new Map<string, string[]>();
  for (const row of rows) {
    const title = pick(row, ["title", "product", "name", "product title"]);
    const handle =
      pick(row, ["handle"]) ||
      title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!handle) continue;
    let item = items.get(handle);
    if (!item) {
      if (!title && format === "shopify_products") continue; // variant row before its product
      item = { handle, title, productType: "", category: "", tags: [], description: "", price: null, colorways: [] };
      items.set(handle, item);
    }
    item.title ||= title;
    item.productType ||= pick(row, ["type", "product type"]);
    item.category ||= pick(row, ["product category", "category"]);
    if (!item.tags.length) {
      item.tags = pick(row, ["tags"]).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30);
    }
    item.description ||= stripHtml(pick(row, ["body html", "description", "body"])).slice(0, 500);
    const price = money(pick(row, ["variant price", "price"]));
    if (price > 0 && (item.price === null || price < item.price)) item.price = price;

    for (const i of [1, 2, 3]) {
      if (COLOR_OPTION.test(pick(row, [`option${i} name`]))) colorOption.set(handle, i);
    }
    const sku = pick(row, ["variant sku", "sku"]);
    if (sku) skus.set(handle, [...(skus.get(handle) ?? []), sku]);
    const photo = pick(row, ["image src", "image url", "image"]);
    if (photo && !firstImage.has(handle)) firstImage.set(handle, photo);
    const option = colorOption.get(handle);
    const color = option
      ? pick(row, [`option${option} value`])
      : format === "catalog_csv"
        ? pick(row, ["color", "colour", "colorway", "color name"])
        : "";
    if (color) addColorway(item, color, sku, pick(row, ["variant image"]));
    const field = Object.keys(row).find((k) => /metafield/i.test(k) && /colou?r/i.test(k));
    const listed = field ? (row[field] ?? "").split(/[;,]/).map((c) => c.trim()).filter(Boolean) : [];
    if (listed.length) fieldColors.set(handle, listed);
  }
  for (const item of items.values()) {
    if (!item.colorways.length) {
      for (const c of fieldColors.get(item.handle) ?? []) {
        for (const sku of skus.get(item.handle) ?? [""]) addColorway(item, c, sku, "");
      }
    }
    for (const cw of item.colorways) cw.image ||= firstImage.get(item.handle) ?? "";
  }
  return [...items.values()].filter((i) => i.title);
}
