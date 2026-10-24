// Shopify's side of setting up in Claude, from Shopify's own docs. Shopify
// owns these steps, so the guide says when they were checked and links
// Shopify's pages for the latest. The queries and limits come from the code
// that runs them.
import { COUNT_LIMITS, SHOPIFY_TOOLS, SHOPIFYQL } from "../affinity/shopify-counts";
import { STOREFRONT } from "../affinity/storefront";

export const SHOPIFY = {
  checked: "October 2026",
  analyticsTool: SHOPIFY_TOOLS.analytics,
  queries: SHOPIFYQL,
  /** Postal codes the first query returns. */
  postalRows: COUNT_LIMITS.postalRows,
  /** The most products one import reads. */
  maxProducts: STOREFRONT.maxPages * STOREFRONT.pageSize,
  docs: {
    connector: "https://help.shopify.com/en/manual/ai-powered-tools/connecting-ai-tools/shopify-connector-for-claude",
    salesSchema: "https://shopify.dev/docs/api/shopifyql/latest/schemas/sales_revenue/sales",
  },
} as const;
