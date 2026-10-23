// Claude's pass over each brand's new products, a minute or so after they're
// uploaded, so nobody runs scripts/tag-catalog.ts by hand. It runs here, not
// on Vercel, because a big catalog takes longer than a function may run.
// One brand at a time, the newest upload first. Each slice of products is
// saved as it finishes, so a restart keeps the work.
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pendingWork, runCatalogPass } from "../lib/affinity/catalog-tagging";
import { estimateCost, type Send, type Usage } from "../lib/affinity/claude-tagger";
import { errorMessage, log } from "./log";

const MINUTE = 60_000;

/** How long the tagger waits before looking again. */
export const TAGGER_DELAYS = {
  /** Nothing to tag. */
  idle: MINUTE,
  /** Straight on to the next brand. */
  next: 5_000,
  /** Products Claude couldn't tag get another try after this. */
  retry: 60 * MINUTE,
  error: 5 * MINUTE,
  /** Claude refused the key or the model: a retry soon won't help. */
  rejected: 60 * MINUTE,
};

export interface TaggerOptions {
  send: { products: Send; colors: Send };
  /** For the cost estimate in the log. */
  model: string;
  now?: () => number;
}

/** Errors only a fix to the engine's settings will clear. */
const rejected = (e: unknown) =>
  e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError;

export class CatalogTagger {
  /** When each brand's last pass started. */
  private readonly started = new Map<string, number>();
  private readonly now: () => number;

  constructor(
    private readonly db: SupabaseClient,
    private readonly options: TaggerOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /** Brands with products or color names only the rules have read, and
   *  when they last changed, newest first. */
  private async pending(): Promise<{ brandId: string; changedAt: number }[]> {
    const changed = new Map<string, number>();
    for (const table of ["brand_products", "brand_colors"]) {
      const { data, error } = await this.db
        .from(table)
        .select("brand_id, updated_at")
        .eq("tagged_by", "rules")
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      for (const row of data ?? []) {
        const id = row.brand_id as string;
        changed.set(id, Math.max(changed.get(id) ?? 0, Date.parse(row.updated_at as string)));
      }
    }
    return [...changed].map(([brandId, changedAt]) => ({ brandId, changedAt })).sort((a, b) => b.changedAt - a.changedAt);
  }

  /** Tags the brand that's due, if any, and says how long to wait before
   *  the next tick. */
  async tick(): Promise<number> {
    try {
      const due = (await this.pending()).find(({ brandId, changedAt }) => {
        const last = this.started.get(brandId);
        // Never tried, uploaded since, or time to retry what didn't take.
        return last === undefined || changedAt > last || this.now() - last >= TAGGER_DELAYS.retry;
      });
      if (!due) return TAGGER_DELAYS.idle;
      this.started.set(due.brandId, this.now());
      await this.tagBrand(due.brandId);
      return TAGGER_DELAYS.next;
    } catch (e) {
      if (rejected(e)) {
        log("ERROR", "Catalog tagging paused: Claude rejected the API key or model", { error: errorMessage(e) });
        return TAGGER_DELAYS.rejected;
      }
      log("ERROR", "Catalog tagging failed", { error: errorMessage(e) });
      return TAGGER_DELAYS.error;
    }
  }

  private async tagBrand(brandId: string): Promise<void> {
    const { data, error } = await this.db.from("brands").select("id, name").eq("id", brandId).maybeSingle();
    if (error) throw error;
    if (!data) return;
    const brand = { id: data.id as string, name: data.name as string };
    const work = await pendingWork(this.db, brand);
    if (!work.products.length && !work.colorNames.length) return;

    log("INFO", "Tagging catalog", { brand: brand.name, products: work.products.length, colors: work.colorNames.length });
    const pass = await runCatalogPass(work, {
      send: this.options.send,
      saveTo: { db: this.db, brand },
      log: (line) => log("WARNING", line, { brand: brand.name }),
    });
    const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    for (const r of [pass.run, pass.colors]) for (const k of Object.keys(usage) as (keyof Usage)[]) usage[k] += r?.usage[k] ?? 0;
    const cost = estimateCost(this.options.model, usage);
    log("INFO", "Tagged catalog", {
      brand: brand.name,
      tagged: pass.saved,
      notTagged: pass.run?.failed.length ?? 0,
      colors: pass.colors?.colors.size ?? 0,
      requests: (pass.run?.requests ?? 0) + (pass.colors?.requests ?? 0),
      ...(cost === null ? {} : { costUsd: Math.round(cost * 100) / 100 }),
    });
  }
}
