// Claude's pass over a brand's saved catalog: the products and color names
// Claude hasn't done yet. The engine runs it a minute or so after each
// product upload (engine/tagger.ts); scripts/tag-catalog.ts runs it by hand.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  nameColorsWithClaude,
  tagWithClaude,
  type ColorRun,
  type ProductInput,
  type Send,
  type TagRun,
  type Usage,
} from "./claude-tagger";
import type { AffinityReport } from "./compute";
import { loadCatalog, loadColorNames, recomputeReport, saveClaudeTags, saveColorNames, type Brand, type StoredProduct } from "./store";

export interface CatalogWork {
  /** Products on file. */
  total: number;
  /** Products for Claude: the ones only the rules have tagged, or all. */
  products: StoredProduct[];
  /** Color names Claude hasn't read yet, or all. */
  colorNames: string[];
}

const distinct = (names: string[]) => [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];

/** What Claude still has to do for a brand. all redoes what it already did. */
export async function pendingWork(db: SupabaseClient, brand: Brand, options: { all?: boolean } = {}): Promise<CatalogWork> {
  const [saved, known] = await Promise.all([loadCatalog(db, brand.id), loadColorNames(db, brand.id)]);
  return {
    total: saved.length,
    products: saved.filter((p) => options.all || p.taggedBy !== "claude"),
    colorNames: distinct(saved.flatMap((p) => p.colorways.map((c) => c.name))).filter(
      (n) => options.all || known.get(n.toLowerCase())?.taggedBy !== "claude",
    ),
  };
}

export interface CatalogPass {
  run: TagRun | null;
  colors: ColorRun | null;
  /** Products saved with Claude's tags. */
  saved: number;
  /** The brand's refreshed report: null when nothing was saved, or the
   *  brand hasn't uploaded customers. */
  report: AffinityReport | null;
}

export interface PassOptions {
  send: { products: Send; colors: Send };
  /** Where to save. Without it the pass only looks. */
  saveTo?: { db: SupabaseClient; brand: Brand };
  /** Products per save, so a pass that stops keeps what it finished. */
  sliceSize?: number;
  batchSize?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  log?: (line: string) => void;
}

function addRun(total: TagRun, part: TagRun): TagRun {
  for (const [handle, tags] of part.tags) total.tags.set(handle, tags);
  total.failed.push(...part.failed);
  total.unknownKeys.push(...part.unknownKeys);
  for (const k of Object.keys(total.usage) as (keyof Usage)[]) total.usage[k] += part.usage[k];
  total.requests += part.requests;
  for (const m of part.models) total.models.add(m);
  return total;
}

/** Tags the products a slice at a time, saving each slice, then names the
 *  colors and refreshes the brand's report. */
export async function runCatalogPass(
  work: { products: ProductInput[]; colorNames: string[] },
  options: PassOptions,
): Promise<CatalogPass> {
  const sliceSize = options.sliceSize ?? 200;
  const target = options.saveTo;
  let run: TagRun | null = null;
  let saved = 0;
  for (let from = 0; from < work.products.length; from += sliceSize) {
    const slice = work.products.slice(from, from + sliceSize);
    const part = await tagWithClaude(slice, {
      send: options.send.products,
      batchSize: options.batchSize,
      concurrency: options.concurrency,
      onProgress: (done) => options.onProgress?.(from + done, work.products.length),
      log: options.log,
    });
    run = run ? addRun(run, part) : part;
    if (!target) continue;
    const tagged = slice.flatMap((p) => {
      const tags = part.tags.get(p.handle);
      return tags ? [{ handle: p.handle, title: p.title, tags }] : [];
    });
    await saveClaudeTags(target.db, target.brand, tagged);
    saved += tagged.length;
  }

  const colors = work.colorNames.length
    ? await nameColorsWithClaude(work.colorNames, { send: options.send.colors, log: options.log })
    : null;
  if (target && colors?.colors.size) {
    await saveColorNames(target.db, target.brand, [...colors.colors].map(([name, hex]) => ({ name, hex })), "claude");
  }
  const changed = saved > 0 || (colors?.colors.size ?? 0) > 0;
  const report = target && changed ? await recomputeReport(target.db, target.brand) : null;
  return { run, colors, saved, report };
}
