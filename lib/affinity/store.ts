// Server-side storage for brands, their counts, catalogs and reports
// (supabase/004_affinity.sql). Used by the upload API and the scripts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAffinity, type AffinityReport, type AreaCount, type ProductCount, type TaggedProduct } from "./compute";
import type { Country } from "./geo";
import type { CatalogItem, CustomerImport } from "./imports";
import { tagProduct, type ProductTags } from "./tagging";

export interface Brand {
  id: string;
  name: string;
}

const PAGE = 1000;

/** Supabase returns at most 1,000 rows per request; read them all. */
async function selectAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function insertChunks(db: SupabaseClient, table: string, rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await db.from(table).insert(rows.slice(i, i + PAGE));
    if (error) throw error;
  }
}

/** A brand by id or upload token, for the scripts. */
export async function findBrand(db: SupabaseClient, ref: string): Promise<Brand | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) return brandByToken(db, ref);
  const { data, error } = await db.from("brands").select("id, name").eq("id", ref).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id as string, name: data.name as string } : null;
}

export async function brandByToken(db: SupabaseClient, token: string): Promise<Brand | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { data, error } = await db.from("brands").select("id, name").eq("upload_token", token).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id as string, name: data.name as string } : null;
}

/** Replaces the brand's customer counts (and product counts, for an order
 *  export) with this upload. */
export async function saveCustomerUpload(db: SupabaseClient, brand: Brand, upload: CustomerImport): Promise<void> {
  const del = await db.from("brand_area_counts").delete().eq("brand_id", brand.id);
  if (del.error) throw del.error;
  await insertChunks(
    db,
    "brand_area_counts",
    upload.areas.map((a) => ({
      brand_id: brand.id,
      country: a.country,
      area: a.area,
      customers: Math.round(a.customers),
      orders: Math.round(a.orders ?? 0),
      revenue: a.revenue ?? 0,
    })),
  );
  if (upload.format === "shopify_orders") {
    const delProducts = await db.from("brand_product_counts").delete().eq("brand_id", brand.id);
    if (delProducts.error) throw delProducts.error;
    await insertChunks(
      db,
      "brand_product_counts",
      upload.products.map((p) => ({
        brand_id: brand.id,
        country: p.country,
        area: p.area,
        product: p.product,
        orders: Math.round(p.orders),
        revenue: p.revenue ?? 0,
      })),
    );
  }
  const { error } = await db.from("brand_uploads").insert({
    brand_id: brand.id,
    format: upload.format,
    rows_read: upload.rows,
    rows_saved: upload.areas.length + upload.products.length,
    customers: upload.areas.reduce((s, a) => s + a.customers, 0),
  });
  if (error) throw error;
}

function tagColumns(tags: ProductTags) {
  return { teams: tags.teams, colors: tags.colors, uses: tags.uses, seasons: tags.seasons, interests: tags.interests };
}

/** Saves the catalog with rule-based tags. Products Claude already tagged
 *  keep Claude's tags. */
export async function saveCatalog(
  db: SupabaseClient,
  brand: Brand,
  format: string,
  items: CatalogItem[],
): Promise<void> {
  const existing = await selectAll<{ handle: string; tagged_by: string }>((from, to) =>
    db.from("brand_products").select("handle, tagged_by").eq("brand_id", brand.id).range(from, to),
  );
  const byClaude = new Set(existing.filter((p) => p.tagged_by === "claude").map((p) => p.handle));
  const now = new Date().toISOString();
  const rows = items.map((item) => {
    const base = {
      brand_id: brand.id,
      handle: item.handle,
      title: item.title,
      product_type: item.productType || null,
      category: item.category || null,
      tags: item.tags,
      description: item.description || null,
      price: item.price,
      updated_at: now,
    };
    if (byClaude.has(item.handle)) return base;
    return { ...base, ...tagColumns(tagProduct(item)), tagged_by: "rules" };
  });
  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await db.from("brand_products").upsert(rows.slice(i, i + PAGE), { onConflict: "brand_id,handle" });
    if (error) throw error;
  }
  const { error } = await db.from("brand_uploads").insert({
    brand_id: brand.id,
    format,
    rows_read: items.length,
    rows_saved: rows.length,
  });
  if (error) throw error;
}

export interface StoredProduct extends Omit<CatalogItem, "price"> {
  taggedBy: "rules" | "claude";
}

/** The brand's catalog as saved, for Claude's tagging pass. */
export async function loadCatalog(db: SupabaseClient, brandId: string): Promise<StoredProduct[]> {
  const rows = await selectAll<{
    handle: string;
    title: string;
    product_type: string | null;
    category: string | null;
    tags: string[] | null;
    description: string | null;
    tagged_by: "rules" | "claude";
  }>((from, to) =>
    db
      .from("brand_products")
      .select("handle, title, product_type, category, tags, description, tagged_by")
      .eq("brand_id", brandId)
      .order("handle")
      .range(from, to),
  );
  return rows.map((r) => ({
    handle: r.handle,
    title: r.title,
    productType: r.product_type ?? "",
    category: r.category ?? "",
    tags: r.tags ?? [],
    description: r.description ?? "",
    taggedBy: r.tagged_by,
  }));
}

/** Saves Claude's tags. Later catalog uploads keep them (see saveCatalog). */
export async function saveClaudeTags(
  db: SupabaseClient,
  brand: Brand,
  products: { handle: string; title: string; tags: ProductTags }[],
): Promise<void> {
  const now = new Date().toISOString();
  const rows = products.map((p) => ({
    brand_id: brand.id,
    handle: p.handle,
    title: p.title,
    ...tagColumns(p.tags),
    tagged_by: "claude",
    updated_at: now,
  }));
  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await db.from("brand_products").upsert(rows.slice(i, i + PAGE), { onConflict: "brand_id,handle" });
    if (error) throw error;
  }
}

export interface BrandData {
  areas: AreaCount[];
  products: ProductCount[];
  catalog: TaggedProduct[];
}

export async function loadBrandData(db: SupabaseClient, brandId: string): Promise<BrandData> {
  const [areas, products, catalog] = await Promise.all([
    selectAll<{ country: Country; area: string; customers: number; orders: number; revenue: number }>((from, to) =>
      db.from("brand_area_counts").select("country, area, customers, orders, revenue").eq("brand_id", brandId).range(from, to),
    ),
    selectAll<{ country: Country; area: string; product: string; orders: number; revenue: number }>((from, to) =>
      db.from("brand_product_counts").select("country, area, product, orders, revenue").eq("brand_id", brandId).range(from, to),
    ),
    selectAll<{ title: string; teams: { league: string; teamId: string }[] }>((from, to) =>
      db.from("brand_products").select("title, teams").eq("brand_id", brandId).range(from, to),
    ),
  ]);
  return {
    areas: areas.map((a) => ({ ...a, revenue: Number(a.revenue) })),
    products: products.map((p) => ({ ...p, revenue: Number(p.revenue) })),
    catalog: catalog.filter((p) => Array.isArray(p.teams) && p.teams.length),
  };
}

/** Recomputes and saves the brand's affinity report. Null until the brand
 *  has uploaded customers. */
export async function recomputeReport(db: SupabaseClient, brand: Brand): Promise<AffinityReport | null> {
  const data = await loadBrandData(db, brand.id);
  if (!data.areas.length) return null;
  const report = computeAffinity(data.areas, { products: data.products, catalog: data.catalog });
  const { error } = await db.from("affinity_reports").insert({ brand_id: brand.id, report });
  if (error) throw error;
  return report;
}

export async function latestReport(db: SupabaseClient, brandId: string): Promise<AffinityReport | null> {
  const { data, error } = await db
    .from("affinity_reports")
    .select("report")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.report as AffinityReport | undefined) ?? null;
}

export async function catalogStats(db: SupabaseClient, brandId: string): Promise<{ products: number; tagged: number }> {
  const rows = await selectAll<{ teams: unknown[] }>((from, to) =>
    db.from("brand_products").select("teams").eq("brand_id", brandId).range(from, to),
  );
  return { products: rows.length, tagged: rows.filter((r) => Array.isArray(r.teams) && r.teams.length).length };
}
