import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FetchRefused, hostVerdict, privateAddress, publicGet, type Lookup } from "./public-fetch";

const PUBLIC = "23.227.38.65";
const opts = { timeoutMs: 2000, maxBytes: 1000, maxRedirects: 3 };

/** DNS answers by host, and every name it was asked. */
function dns(table: Record<string, string[]>) {
  const asked: string[] = [];
  const lookup: Lookup = async (host) => {
    asked.push(host);
    if (!table[host]) throw new Error("ENOTFOUND");
    return table[host];
  };
  return { lookup, asked };
}

/** A fetch that answers by URL. */
function web(answer: (url: URL) => Response) {
  const calls: string[] = [];
  const f = (async (input: string | URL) => {
    const url = new URL(input.toString());
    calls.push(url.toString());
    return answer(url);
  }) as typeof fetch;
  return { fetch: f, calls };
}

async function refused(p: Promise<unknown>, reason: FetchRefused["reason"]) {
  await assert.rejects(p, (err: unknown) => err instanceof FetchRefused && err.reason === reason);
}

describe("privateAddress", () => {
  it("knows the addresses nothing public lives on", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      assert.ok(privateAddress(ip), ip);
    }
    for (const ip of [PUBLIC, "8.8.8.8", "2606:4700::1111"]) assert.ok(!privateAddress(ip), ip);
  });
});

describe("hostVerdict", () => {
  it("is public only when every address is", async () => {
    assert.equal(await hostVerdict("shop.example.com", dns({ "shop.example.com": [PUBLIC] }).lookup), "public");
    assert.equal(await hostVerdict("shop.example.com", dns({ "shop.example.com": [PUBLIC, "10.0.0.1"] }).lookup), "private");
    assert.equal(await hostVerdict("gone.example.com", dns({}).lookup), "unresolved");
  });
});

describe("publicGet", () => {
  const ok = web(() => new Response("hello", { status: 200, headers: { "content-type": "text/plain" } }));
  const { lookup } = dns({ "shop.example.com": [PUBLIC], "inside.example.com": ["10.0.0.5"] });

  it("reads a public page", async () => {
    const res = await publicGet("https://shop.example.com/products.json", { ...opts, fetch: ok.fetch, lookup });
    assert.deepEqual([res.status, res.text, res.url], [200, "hello", "https://shop.example.com/products.json"]);
  });

  it("refuses anything but a public https name", async () => {
    for (const url of [
      "http://shop.example.com/",
      "https://shop.example.com:8443/",
      "https://user:pw@shop.example.com/",
      "https://10.0.0.5/",
      "https://[::1]/",
      "https://localhost/",
      "https://printer.local/",
      "https://intranet/",
    ]) {
      await refused(publicGet(url, { ...opts, fetch: ok.fetch, lookup }), "address");
    }
    await refused(publicGet("https://inside.example.com/", { ...opts, fetch: ok.fetch, lookup }), "private");
    await refused(publicGet("https://gone.example.com/", { ...opts, fetch: ok.fetch, lookup }), "unresolved");
  });

  it("follows redirects, checking every hop", async () => {
    const d = dns({ "example.com": [PUBLIC], "www.example.com": [PUBLIC], "inside.example.com": ["10.0.0.5"] });
    const site = web((url) => {
      if (url.host === "example.com") return new Response(null, { status: 301, headers: { location: `https://www.example.com${url.pathname}` } });
      if (url.pathname === "/inside") return new Response(null, { status: 302, headers: { location: "https://inside.example.com/" } });
      if (url.pathname === "/plain") return new Response(null, { status: 302, headers: { location: "http://www.example.com/" } });
      if (url.pathname === "/loop") return new Response(null, { status: 302, headers: { location: "/loop" } });
      return new Response("ok", { status: 200 });
    });
    const res = await publicGet("https://example.com/products.json", { ...opts, fetch: site.fetch, lookup: d.lookup });
    assert.equal(res.url, "https://www.example.com/products.json");
    assert.deepEqual(d.asked, ["example.com", "www.example.com"], "both hops are resolved and checked");
    await refused(publicGet("https://www.example.com/inside", { ...opts, fetch: site.fetch, lookup: d.lookup }), "private");
    await refused(publicGet("https://www.example.com/plain", { ...opts, fetch: site.fetch, lookup: d.lookup }), "address");
    await refused(publicGet("https://www.example.com/loop", { ...opts, fetch: site.fetch, lookup: d.lookup }), "redirects");
  });

  it("caps the size, with or without a length", async () => {
    const big = "x".repeat(2000);
    const declared = web(() => new Response(big, { status: 200, headers: { "content-length": "2000" } }));
    await refused(publicGet("https://shop.example.com/", { ...opts, fetch: declared.fetch, lookup }), "too_big");
    const streamed = web(
      () =>
        new Response(
          new ReadableStream({
            start(c) {
              for (let i = 0; i < 4; i++) c.enqueue(new TextEncoder().encode(big.slice(0, 500)));
              c.close();
            },
          }),
          { status: 200 },
        ),
    );
    await refused(publicGet("https://shop.example.com/", { ...opts, fetch: streamed.fetch, lookup }), "too_big");
  });

  it("gives up when the store doesn't answer in time", async () => {
    const slow = (async (_input: string | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")));
      })) as typeof fetch;
    // AbortSignal.timeout doesn't keep Node running on its own.
    const running = setTimeout(() => {}, 1000);
    await refused(publicGet("https://shop.example.com/", { ...opts, timeoutMs: 50, fetch: slow, lookup }), "timeout");
    clearTimeout(running);
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await refused(publicGet("https://shop.example.com/", { ...opts, fetch: down, lookup }), "network");
  });
});
