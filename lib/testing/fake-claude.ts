// Claude's side of the catalog pass, for unit tests: replies shaped like the
// real ones. A product whose title says "Bolt" is for the Chargers, one that
// says "Mystery" is left out of every reply, and every color name gets a hex.
import { DEFAULT_MODEL, type Reply, type Send } from "../affinity/claude-tagger";

const usage = { input: 100, output: 50, cacheRead: 900, cacheWrite: 0 };
const reply = (body: unknown): Reply => ({ text: JSON.stringify(body), stopReason: "end_turn", model: DEFAULT_MODEL, usage });

/** The lines of a batch prompt, after its first paragraph. */
const lines = (prompt: string) => prompt.slice(prompt.indexOf("\n\n") + 2).split("\n");

export function fakeClaude(options: { fail?: (call: number) => Error | null } = {}) {
  const calls = { products: [] as string[][], colors: [] as string[][] };
  const products: Send = async (prompt) => {
    const error = options.fail?.(calls.products.length + 1);
    if (error) throw error;
    const batch = lines(prompt).map((l) => JSON.parse(l) as { ref: string; title: string });
    calls.products.push(batch.map((p) => p.title));
    return reply({
      products: batch
        .filter((p) => !p.title.includes("Mystery"))
        .map((p) => ({
          ref: p.ref,
          teams: p.title.includes("Bolt") ? [{ key: "nfl:24", why: `"Bolt" in the title` }] : [],
          colors: [],
          uses: [],
          seasons: [],
          interests: [],
        })),
    });
  };
  const colors: Send = async (prompt) => {
    const names = lines(prompt).map((l) => l.replace(/^c\d+: /, ""));
    calls.colors.push(names);
    return reply({ colors: names.map((_, i) => ({ ref: `c${i + 1}`, hex: ["c2b280"] })) });
  };
  return { send: { products, colors }, calls };
}
