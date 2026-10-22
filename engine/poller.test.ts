import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { LEAGUES } from "../lib/leagues";
import { loadConfig } from "./config";
import type { FeedClient } from "./espn/client";
import type { EspnEvent, EspnScoreboard } from "./espn/types";
import { rulesFor } from "./moments/sports";
import { etDate, LeaguePoller } from "./poller";
import { MemoryStore } from "./store/memory";

const nfl = LEAGUES.find((l) => l.id === "nfl")!;
const config = { ...loadConfig({ DRY_RUN: "1" }), lookaheadMs: Number.MAX_SAFE_INTEGER };

function fixtureEvent(name: string, shortName: string): EspnEvent {
  const board = JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf8"),
  ) as EspnScoreboard;
  const ev = board.events?.find((e) => e.shortName === shortName);
  assert.ok(ev);
  return ev;
}

/** WSH @ PHI with the status and score changed. */
function wshAtPhi(state: "in" | "post", period: number, clock: number, phi: number, wsh: number): EspnScoreboard {
  const ev = structuredClone(fixtureEvent("nfl-week1", "WSH @ PHI"));
  const comp = ev.competitions![0];
  comp.status = {
    clock,
    displayClock: `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`,
    period,
    type: {
      state,
      completed: state === "post",
      shortDetail: state === "post" ? "Final" : `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")} - 4th`,
    },
  };
  for (const c of comp.competitors!) {
    c.score = String(c.homeAway === "home" ? phi : wsh);
    c.linescores = [];
  }
  return { events: [ev] };
}

function fakeClient(boards: EspnScoreboard[]): FeedClient & { calls: number } {
  const client = {
    calls: 0,
    async scoreboard() {
      const board = boards[Math.min(client.calls, boards.length - 1)];
      client.calls++;
      return board;
    },
    async summary() {
      return {};
    },
  };
  return client;
}

describe("LeaguePoller", () => {
  it("emits live moments once, then the final moments, then nothing", async () => {
    const store = new MemoryStore();
    const client = fakeClient([
      wshAtPhi("in", 4, 200, 21, 17),
      wshAtPhi("in", 4, 95, 21, 17),
      wshAtPhi("post", 4, 0, 24, 22),
      wshAtPhi("post", 4, 0, 24, 22),
    ]);
    const poller = new LeaguePoller(nfl, rulesFor("nfl"), { client, store, config });

    assert.equal(await poller.tick(), config.livePollMs, "polls fast while a game is live");
    assert.deepEqual([...store.moments.keys()].map((k) => k.split(":")[0]).sort(), [
      "close_game",
      "close_game",
    ]);

    await poller.tick();
    assert.equal(store.moments.size, 2, "same moments are not saved twice");

    await poller.tick();
    const types = [...store.moments.values()].map((m) => `${m.type}:${m.team.abbreviation}`).sort();
    assert.deepEqual(types, [
      "close_game:PHI",
      "close_game:WSH",
      "heartbreak_loss:WSH",
      "rivalry_win:PHI",
    ]);

    await poller.tick();
    assert.equal(store.moments.size, 4, "a final is only processed once");
    assert.equal(poller.status.momentsSaved, 4);
    assert.equal(store.heartbeats.get("nfl")?.ok, true);
    assert.equal(store.games.size, 1);
    assert.equal(store.teams.size, 2);
  });

  it("a restart remembers finals it already handled", async () => {
    const store = new MemoryStore();
    const first = new LeaguePoller(nfl, rulesFor("nfl"), {
      client: fakeClient([wshAtPhi("in", 4, 200, 21, 17), wshAtPhi("post", 4, 0, 24, 22)]),
      store,
      config,
    });
    await first.tick();
    await first.tick();
    const saved = store.moments.size;

    const second = new LeaguePoller(nfl, rulesFor("nfl"), {
      client: fakeClient([wshAtPhi("post", 4, 0, 24, 22)]),
      store,
      config,
      now: () => new Date("2026-09-14T03:00:00Z"),
    });
    await second.tick();
    assert.equal(store.moments.size, saved);
    assert.equal(second.status.momentsSaved, 0);
  });

  it("a restart mid-game still catches the final", async () => {
    const store = new MemoryStore();
    const first = new LeaguePoller(nfl, rulesFor("nfl"), {
      client: fakeClient([wshAtPhi("in", 4, 200, 21, 17)]),
      store,
      config,
    });
    await first.tick();

    const second = new LeaguePoller(nfl, rulesFor("nfl"), {
      client: fakeClient([wshAtPhi("post", 4, 0, 24, 22)]),
      store,
      config,
      now: () => new Date("2026-10-22T13:00:00Z"),
    });
    await second.tick();
    assert.ok([...store.moments.values()].some((m) => m.type === "rivalry_win"));
  });

  it("ignores old finals on a cold start", async () => {
    const store = new MemoryStore();
    const poller = new LeaguePoller(nfl, rulesFor("nfl"), {
      client: fakeClient([wshAtPhi("post", 4, 0, 24, 22)]),
      store,
      config,
      now: () => new Date("2026-10-22T13:00:00Z"),
    });
    assert.equal(await poller.tick(), config.idlePollMs);
    assert.equal(store.moments.size, 0);
  });

  it("backs off and records the error when the feed fails", async () => {
    const store = new MemoryStore();
    const client: FeedClient = {
      async scoreboard() {
        throw new Error("feed down");
      },
      async summary() {
        return {};
      },
    };
    const poller = new LeaguePoller(nfl, rulesFor("nfl"), { client, store, config });
    assert.equal(await poller.tick(), 15_000);
    assert.equal(await poller.tick(), 30_000);
    assert.equal(poller.status.consecutiveFailures, 2);
    assert.equal(store.heartbeats.get("nfl")?.ok, false);
    assert.equal(store.heartbeats.get("nfl")?.error, "feed down");
  });
});

describe("etDate", () => {
  it("uses the US Eastern calendar day", () => {
    // 02:00 UTC is still the previous evening in New York.
    assert.equal(etDate(new Date("2026-10-23T02:00:00Z")), "20261022");
    assert.equal(etDate(new Date("2026-10-23T02:00:00Z"), 1), "20261023");
  });
});
