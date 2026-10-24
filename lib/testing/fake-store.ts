// A Shopify store's public product feed for unit tests: /products.json pages
// of products, with a redirect, a password page, error statuses and one
// failure on request, behind a fetch and a DNS lookup that tests pass in.
import type { FeedProduct } from "../affinity/storefront";
import type { Lookup } from "../public-fetch";

/** A product as the feed has it. colors become a Color option. */
export function feedProduct(i: number, o: { title?: string; colors?: string[] } = {}): FeedProduct {
  const colors = o.colors ?? [];
  return {
    id: 1000 + i,
    handle: `product-${i}`,
    title: o.title ?? `Product ${i}`,
    body_html: `<p>Product <b>${i}</b></p>`,
    product_type: "Hoodie",
    tags: ["fleece", "fall"],
    options: colors.length ? [{ name: "Size", position: 1 }, { name: "Color", position: 2 }] : [{ name: "Title", position: 1 }],
    variants: colors.length
      ? colors.map((c, j) => ({ sku: `P${i}-${j}`, price: "58.00", option1: "M", option2: c, featured_image: { src: `//cdn.example.com/${i}-${j}.jpg` } }))
      : [{ sku: `P${i}`, price: 48, option1: "Default Title", featured_image: null }],
    images: [{ src: `https://cdn.example.com/${i}.jpg` }],
  };
}

export interface FakeStoreOptions {
  host: string;
  products: FeedProduct[];
  /** A host that redirects here, like the apex to www. */
  redirectFrom?: string;
  /** Every page redirects to /password. */
  password?: boolean;
  /** Every request answers with this status. */
  status?: number;
  /** One request for this page answers with this status, then it recovers. */
  failOnce?: { page: number; status: number };
  /** Every page answers with this body instead of products. */
  body?: string;
  /** Addresses by host. Hosts not listed don't resolve. */
  addresses?: Record<string, string[]>;
}

export function fakeStorefront(o: FakeStoreOptions) {
  const requests: string[] = [];
  let failed = false;
  const addresses: Record<string, string[]> = {
    [o.host]: ["23.227.38.65"],
    ...(o.redirectFrom ? { [o.redirectFrom]: ["23.227.38.65"] } : {}),
    ...o.addresses,
  };
  const lookup: Lookup = async (host) => {
    const found = addresses[host];
    if (!found) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND" });
    return found;
  };
  const storeFetch = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    requests.push(url.toString());
    if (o.redirectFrom && url.host === o.redirectFrom) {
      return new Response(null, { status: 301, headers: { location: `https://${o.host}${url.pathname}${url.search}` } });
    }
    if (url.pathname.startsWith("/password")) return new Response("<html>Opening soon</html>", { status: 200, headers: { "content-type": "text/html" } });
    if (o.password) return new Response(null, { status: 302, headers: { location: "/password" } });
    if (o.status) return new Response("", { status: o.status });
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 30);
    if (o.failOnce && o.failOnce.page === page && !failed) {
      failed = true;
      return new Response("", { status: o.failOnce.status, headers: { "retry-after": "1" } });
    }
    if (o.body !== undefined) return new Response(o.body, { status: 200, headers: { "content-type": "text/html" } });
    const products = o.products.slice((page - 1) * limit, page * limit);
    return new Response(JSON.stringify({ products }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetch: storeFetch, lookup, requests };
}
