import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRIGGERS } from "../../lib/triggers";
import { EMITTED_TYPES } from "./types";

describe("moment types", () => {
  // The site lists every type; the ones the engine can't detect yet say so.
  it("match the trigger library: detected types live, the rest marked coming", () => {
    const live = TRIGGERS.filter((t) => !t.coming).map((t) => t.id);
    assert.deepEqual([...live].sort(), [...EMITTED_TYPES].sort());
  });
});
