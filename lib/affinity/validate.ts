// Checks upload bodies before anything is stored. The server re-checks the
// browser's work: areas must already be coarse (no full ZIPs or postcodes).
import type { AreaCount, ProductCount } from "./compute";
import type { Country } from "./geo";
import {
  formatKind,
  MAX_COLORWAYS,
  MAX_SKUS,
  type CatalogItem,
  type Colorway,
  type CustomerImport,
  type ImportFormat,
} from "./imports";

const FORMATS: ImportFormat[] = [
  "shopify_customers",
  "shopify_orders",
  "klaviyo_profiles",
  "counts_csv",
  "shopify_products",
  "catalog_csv",
];

const AREA_PATTERN: Record<Country, RegExp> = {
  US: /^\d{3}$/,
  CA: /^[A-Z]\d[A-Z]$/,
  GB: /^[A-Z]{1,2}\d[A-Z0-9]?$/,
};

export const LIMITS = { areas: 10_000, products: 60_000, items: 5_000 } as const;

export class UploadError extends Error {}

function fail(message: string): never {
  throw new UploadError(message);
}

function count(v: unknown, max = 10_000_000): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > max) fail("Counts must be positive numbers");
  return n;
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function area(raw: Record<string, unknown>): { country: Country; area: string } {
  const country = raw.country as Country;
  const code = text(raw.area, 4);
  if (!(country in AREA_PATTERN) || !AREA_PATTERN[country].test(code)) {
    fail(`Postal areas must be coarse (3-digit ZIP, FSA or district), got ${String(raw.country)}:${String(raw.area)}`);
  }
  return { country, area: code };
}

function format(v: unknown, kind: "customers" | "catalog"): ImportFormat {
  const f = v as ImportFormat;
  if (!FORMATS.includes(f) || formatKind(f) !== kind) fail("Unknown file format");
  return f;
}

export function parseCustomerUpload(body: unknown): CustomerImport {
  const b = (body ?? {}) as Record<string, unknown>;
  const areas = Array.isArray(b.areas) ? b.areas : fail("No customer counts in the upload");
  const products = Array.isArray(b.products) ? b.products : [];
  if (areas.length === 0) fail("No customers with a postal code we could place");
  if (areas.length > LIMITS.areas) fail("Too many postal areas");
  if (products.length > LIMITS.products) fail("Too many product rows");
  return {
    format: format(b.format, "customers"),
    rows: count(b.rows),
    skipped: count(b.skipped),
    areas: areas.map(
      (raw): AreaCount => ({
        ...area(raw as Record<string, unknown>),
        customers: Math.round(count((raw as AreaCount).customers)),
        orders: Math.round(count((raw as AreaCount).orders)),
        revenue: count((raw as AreaCount).revenue, 1e12),
      }),
    ),
    products: products.map((raw): ProductCount => {
      const r = raw as Record<string, unknown>;
      const product = text(r.product, 120) || fail("Product rows need a product name");
      return { ...area(r), product, orders: Math.round(count(r.orders)), revenue: count(r.revenue, 1e12) };
    }),
  };
}

/** Photos are shown on the brand's report, so only https links. */
function imageUrl(v: unknown): string {
  const url = text(v, 500);
  return /^https:\/\/[^\s"'<>]+$/.test(url) ? url : "";
}

function colorways(v: unknown): Colorway[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_COLORWAYS).flatMap((raw): Colorway[] => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = text(r.name, 60);
    if (!name) return [];
    const skus = Array.isArray(r.skus) ? r.skus.slice(0, MAX_SKUS).map((s) => text(s, 80)).filter(Boolean) : [];
    return [{ name, skus, image: imageUrl(r.image) }];
  });
}

export function parseCatalogUpload(body: unknown): { format: ImportFormat; items: CatalogItem[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(b.items) ? b.items : fail("No products in the upload");
  return { format: format(b.format, "catalog"), items: parseCatalogItems(items) };
}

/** Products checked and trimmed the same way, from an upload or a store's
 *  public feed. */
export function parseCatalogItems(raw: unknown): CatalogItem[] {
  const items = Array.isArray(raw) ? raw : fail("No products in the upload");
  if (items.length === 0) fail("No products found in the file");
  if (items.length > LIMITS.items) fail("Too many products");
  return items.map((raw): CatalogItem => {
    const r = raw as Record<string, unknown>;
    const title = text(r.title, 200) || fail("Every product needs a title");
    const price = r.price === null || r.price === undefined ? null : count(r.price, 1e9);
    return {
      handle: text(r.handle, 200) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title,
      productType: text(r.productType, 100),
      category: text(r.category, 200),
      tags: Array.isArray(r.tags) ? r.tags.slice(0, 30).map((t) => text(t, 60)).filter(Boolean) : [],
      description: text(r.description, 500),
      price,
      colorways: colorways(r.colorways),
    };
  });
}
