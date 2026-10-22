import assert from "node:assert/strict";
import { describe, it } from "node:test";

import Anthropic from "@anthropic-ai/sdk";
import {
  batchPrompt,
  DEFAULT_MODEL,
  estimateCost,
  systemPrompt,
  tagWithClaude,
  teamDirectory,
  type ProductInput,
  type Reply,
} from "./claude-tagger";

const product = (handle: string, title: string, extra: Partial<ProductInput> = {}): ProductInput => ({
  handle,
  title,
  productType: "",
  category: "",
  tags: [],
  description: "",
  ...extra,
});

const usage = { input: 100, output: 50, cacheRead: 900, cacheWrite: 0 };

function reply(products: unknown[], extra: Partial<Reply> = {}): Reply {
  return { text: JSON.stringify({ products }), stopReason: "end_turn", model: DEFAULT_MODEL, usage, ...extra };
}

const entry = (ref: string, extra: Record<string, unknown> = {}) => ({
  ref,
  teams: [],
  colors: [],
  uses: [],
  seasons: [],
  interests: [],
  ...extra,
});

/** Refs in a batch prompt, in order. */
const refs = (prompt: string) => [...prompt.matchAll(/"ref":"(p\d+)"/g)].map((m) => m[1]);

describe("team directory", () => {
  it("lists pro teams by key and schools once with both keys", () => {
    const { text, keys } = teamDirectory();
    assert.match(text, /^nfl:21 PHI Philadelphia Eagles$/m);
    assert.match(text, /^ncaaf:130 ncaab:130 MICH Michigan Wolverines$/m);
    assert.match(text, /^ncaab:2250 GONZ Gonzaga Bulldogs$/m);
    assert.deepEqual(keys.get("ncaaf:130"), { league: "ncaaf", teamId: "130", name: "Michigan Wolverines" });
  });

  it("system prompt is identical across calls, so it caches", () => {
    assert.equal(systemPrompt(), systemPrompt());
    assert.ok(systemPrompt().length > 10_000);
  });
});

describe("batchPrompt", () => {
  it("numbers products and leaves out empty fields", () => {
    const p = batchPrompt([product("a", "Bird Gang Koozie", { tags: ["eagles"] }), product("b", "Plain Mug")]);
    assert.deepEqual(refs(p), ["p1", "p2"]);
    assert.ok(p.includes('{"ref":"p1","title":"Bird Gang Koozie","tags":["eagles"]}'));
    assert.ok(p.includes('{"ref":"p2","title":"Plain Mug"}'));
  });
});

describe("tagWithClaude", () => {
  it("maps tags back by ref and drops what isn't ours", async () => {
    const run = await tagWithClaude([product("koozie", "Bird Gang Koozie"), product("mug", "Wolverines Mug")], {
      send: async () =>
        reply([
          entry("p2", {
            teams: [
              { key: "ncaaf:130", why: "says Wolverines" },
              { key: "ncaab:130", why: "says Wolverines" },
            ],
            uses: ["home"],
          }),
          entry("p1", {
            teams: [
              { key: "nfl:21", why: "Bird Gang is an Eagles chant" },
              { key: "NFL:21", why: "duplicate" },
              { key: "nfl:9999", why: "made up" },
            ],
            colors: ["midnight green", "mauve"],
            uses: ["tailgate"],
            interests: ["surf"],
          }),
        ]),
    });
    assert.deepEqual(run.tags.get("koozie"), {
      teams: [{ league: "nfl", teamId: "21", name: "Philadelphia Eagles", why: "Bird Gang is an Eagles chant" }],
      colors: ["midnight green"],
      uses: ["tailgate"],
      seasons: [],
      interests: ["surf"],
    });
    assert.deepEqual(run.tags.get("mug")?.teams.map((t) => `${t.league}:${t.teamId}`), ["ncaaf:130", "ncaab:130"]);
    assert.deepEqual(run.unknownKeys, ["nfl:9999"]);
    assert.deepEqual(run.failed, []);
    assert.equal(run.requests, 1);
    assert.deepEqual(run.usage, usage);
  });

  it("asks again once for products left out of a reply", async () => {
    const prompts: string[] = [];
    const run = await tagWithClaude([product("a", "A"), product("b", "B"), product("c", "C")], {
      send: async (prompt) => {
        prompts.push(prompt);
        // The first reply skips p2, and the retry comes back empty too.
        if (prompts.length > 1) return reply([]);
        return reply(refs(prompt).filter((r) => r !== "p2").map((r) => entry(r)));
      },
    });
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /"title":"B"/);
    assert.deepEqual([...run.tags.keys()].sort(), ["a", "c"]);
    assert.deepEqual(run.failed, ["b"]);
  });

  it("halves a batch that was declined or cut off, isolating the product", async () => {
    let calls = 0;
    const items = Array.from({ length: 8 }, (_, i) => product(`h${i}`, i === 5 ? "Trouble" : `Item ${i}`));
    const run = await tagWithClaude(items, {
      send: async (prompt) => {
        calls++;
        if (prompt.includes("Trouble")) return { ...reply([]), text: "", stopReason: "refusal" };
        return reply(refs(prompt).map((r) => entry(r)));
      },
    });
    assert.deepEqual(run.failed, ["h5"]);
    assert.equal(run.tags.size, 7);
    assert.ok(calls <= 7, `took ${calls} calls`);

    const cut = await tagWithClaude([product("a", "A"), product("b", "B")], {
      send: async (prompt) =>
        refs(prompt).length > 1 ? { ...reply([]), text: '{"products":[{"ref":"p1"', stopReason: "max_tokens" } : reply([entry("p1")]),
    });
    assert.deepEqual([...cut.tags.keys()].sort(), ["a", "b"]);
  });

  it("keeps going when a batch fails after the SDK's retries", async () => {
    const items = Array.from({ length: 6 }, (_, i) => product(`h${i}`, `Item ${i}`));
    const run = await tagWithClaude(items, {
      batchSize: 2,
      send: async (prompt) => {
        if (prompt.includes("Item 2")) throw new Anthropic.InternalServerError(529, undefined, "Overloaded", new Headers());
        return reply(refs(prompt).map((r) => entry(r)));
      },
    });
    assert.deepEqual(run.failed.sort(), ["h2", "h3"]);
    assert.equal(run.tags.size, 4);
  });

  it("stops the run on errors a retry won't fix", async () => {
    await assert.rejects(
      tagWithClaude([product("a", "A")], {
        send: async () => {
          throw new Anthropic.AuthenticationError(401, undefined, "invalid x-api-key", new Headers());
        },
      }),
      Anthropic.AuthenticationError,
    );
  });

  it("sends the first batch alone so it can write the prompt cache", async () => {
    const items = Array.from({ length: 10 }, (_, i) => product(`h${i}`, `Item ${i}`));
    let inFlight = 0;
    const seen: number[] = [];
    const progress: number[] = [];
    await tagWithClaude(items, {
      batchSize: 2,
      concurrency: 3,
      onProgress: (done) => progress.push(done),
      send: async (prompt) => {
        inFlight++;
        seen.push(inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return reply(refs(prompt).map((r) => entry(r)));
      },
    });
    assert.equal(seen[0], 1);
    assert.equal(Math.max(...seen), 3);
    assert.equal(progress.at(-1), 10);
  });
});

describe("estimateCost", () => {
  it("prices a run, or says nothing for unknown models", () => {
    assert.equal(estimateCost(DEFAULT_MODEL, { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 1e6 }), 29.2);
    assert.equal(estimateCost("some-other-model", usage), null);
  });
});
