// One golf tour: its current leaderboard every 5 minutes while an event is
// under way, every 10 otherwise. The field is saved as athletes, and a few
// bios each poll tell where golfers were born. A winner, or the leaders
// going into the final round, is recorded as a result, with the bios of
// those players read right away; with HOMETOWN=1 the towns they're from get
// their moments (lib/hometown). It keeps no state that matters: after a
// restart a repeat adds nothing. See engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { athleteId, athletePlace, athletesReady, eventResults, saveAthletes, savePlaces, saveResults, type Athlete, type AthleteResult } from "../../lib/athletes";
import { makeHometownMoments } from "../../lib/hometown";
import { nameKey, resolvePlace, type Resolved } from "../../lib/places";
import type { Tour } from "../../lib/tours";
import { birthPlaceText } from "../athletes/feed";
import { errorMessage, log } from "../log";
import type { GolfFeed } from "./feed";
import { normalizeLeaderboard } from "./normalize";
import { golfOutcome, type GolfOutcome } from "./outcome";
import type { GolfEvent, GolfPlayer } from "./types";

const MINUTE = 60_000;

export const GOLF_POLL = {
  /** While an event is under way. */
  live: 5 * MINUTE,
  idle: 10 * MINUTE,
  /** Until 009_athletes.sql has run. */
  noTables: 60 * MINUTE,
  /** Bios of the field read each poll, besides the winner's and leaders'. */
  biosPerPoll: 5,
};

export interface GolfPollerOptions {
  /** Make hometown moments (HOMETOWN=1), not just results. */
  hometown: boolean;
  now?: () => number;
  /** lib/places, unless a test swaps it. */
  resolve?: (b: { city: string; state: string; country: string }) => Promise<Resolved>;
}

const golfer = (tour: Tour, p: GolfPlayer): Athlete => ({
  id: athleteId("golf", p.externalId),
  sport: "golf",
  league: tour.id,
  externalId: p.externalId,
  displayName: p.name,
  teamId: null,
  position: null,
  jersey: null,
  rosterStatus: null,
  college: null,
});

export class GolfPoller {
  private readonly now: () => number;
  /** Events whose field this run has saved. */
  private readonly fields = new Set<string>();
  /** Each event's last status, to log when it changes. */
  private readonly seen = new Map<string, string>();
  private failures = 0;
  private waiting = false;

  constructor(
    readonly tour: Tour,
    private readonly db: SupabaseClient,
    private readonly feed: GolfFeed,
    private readonly options: GolfPollerOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /** One poll. Never throws. Returns milliseconds until the next. */
  async tick(): Promise<number> {
    const started = this.now();
    try {
      if (!(await athletesReady(this.db))) {
        if (!this.waiting) log("WARNING", `${this.tour.name} is waiting for supabase/009_athletes.sql to run`);
        this.waiting = true;
        return GOLF_POLL.noTables;
      }
      this.waiting = false;
      const events = normalizeLeaderboard(this.tour.id, await this.feed.leaderboard(this.tour.id));
      for (const e of events) {
        this.note(e);
        if (e.state === "in" || e.state === "final") await this.saveField(e);
        const outcome = golfOutcome(e, this.tour, this.now());
        if (outcome) await this.record(outcome);
      }
      await this.bios(null);
      this.failures = 0;
      await this.heartbeat(started, events, null);
      return events.some((e) => e.state === "in") ? GOLF_POLL.live : GOLF_POLL.idle;
    } catch (e) {
      this.failures++;
      log("WARNING", `${this.tour.name} poll failed`, { tour: this.tour.id, error: errorMessage(e), consecutiveFailures: this.failures });
      await this.heartbeat(started, [], errorMessage(e)).catch(() => {});
      return Math.min(GOLF_POLL.idle, MINUTE * 2 ** (this.failures - 1));
    }
  }

  /** Logs each change in an event's status: the feed is undocumented, and
   *  these show how it reads between rounds. */
  private note(e: GolfEvent): void {
    const status = `${e.statusName} ${e.period ?? "-"}${e.roundComplete ? " complete" : ""}`;
    if (this.seen.get(e.id) === status) return;
    this.seen.set(e.id, status);
    log("INFO", `${e.name}: ${status}`, { tour: this.tour.id, event: e.id, state: e.state, rounds: e.rounds });
  }

  private async saveField(e: GolfEvent): Promise<void> {
    if (this.fields.has(e.id) || !e.players.length) return;
    await saveAthletes(this.db, e.players.map((p) => golfer(this.tour, p)), new Date(this.now()).toISOString());
    this.fields.add(e.id);
  }

  /** Records who won or leads, and makes their towns' moments. */
  private async record(o: GolfOutcome): Promise<void> {
    const ids = o.players.map((p) => athleteId("golf", p.externalId));
    await this.bios(ids);
    const at = new Date(this.now()).toISOString();
    const results: AthleteResult[] = ids.map((id) => ({
      athleteId: id,
      eventKey: o.eventKey,
      eventName: o.eventName,
      kind: o.kind,
      role: "leader",
      teamId: null,
      momentId: null,
      intensity: o.intensity,
      occurredAt: at,
      createdBy: "engine",
    }));
    if (await saveResults(this.db, results)) {
      log("INFO", o.kind === "win" ? `${o.players[0].name} won the ${o.eventName}` : `Leading the ${o.eventName} into the final round: ${o.players.map((p) => p.name).join(", ")}`, {
        tour: this.tour.id,
        event: o.eventKey,
        intensity: o.intensity,
      });
    }
    if (!this.options.hometown) return;
    // The results as first saved, so a repeat keeps the first time.
    const stored = (await eventResults(this.db, o.eventKey)).filter((r) => r.kind === o.kind);
    const { saved } = await makeHometownMoments(
      this.db,
      {
        key: o.eventKey,
        name: o.eventName,
        kind: o.kind,
        league: this.tour.id,
        gameId: null,
        teamId: null,
        teamName: null,
        opponentTeamId: null,
        occurredAt: stored[0]?.occurredAt ?? at,
        startsAt: o.startsAt,
      },
      stored,
    );
    if (saved.length) log("INFO", "Hometown moments", { event: o.eventName, towns: saved.length, examples: saved.slice(0, 3).map((m) => m.headline) });
  }

  /** Where golfers were born, from their bios: these ones, or else a few of
   *  the field Walkoff hasn't read yet. A bio that fails is read again
   *  another time. */
  private async bios(ids: string[] | null): Promise<void> {
    let q = this.db.from("athletes").select("id, sport, external_id, display_name").eq("sport", "golf").is("bio_checked_at", null);
    q = ids ? q.in("id", ids) : q.limit(GOLF_POLL.biosPerPoll);
    const { data, error } = await q;
    if (error) throw error;
    const resolve = this.options.resolve ?? resolvePlace;
    for (const r of (data ?? []) as { id: string; sport: string; external_id: string; display_name: string }[]) {
      let bio;
      try {
        bio = await this.feed.bio(r.external_id);
      } catch (e) {
        log("WARNING", "Golfer bio unavailable", { athlete: r.id, error: errorMessage(e) });
        continue;
      }
      if (bio) await savePlaces(this.db, [athletePlace(r.id, "birthplace", "espn", birthPlaceText(bio), await resolve(bio))]);
      const at = new Date(this.now()).toISOString();
      const { error: e } = await this.db
        .from("athletes")
        .upsert([{ id: r.id, sport: r.sport, external_id: r.external_id, display_name: r.display_name, name_key: nameKey(r.display_name), bio_checked_at: at, updated_at: at }], { onConflict: "id" });
      if (e) throw e;
    }
  }

  /** One row per tour in engine_heartbeats, "golf:pga": games is the
   *  events on the leaderboard, live_games those under way. */
  private async heartbeat(started: number, events: GolfEvent[], error: string | null): Promise<void> {
    const at = new Date(this.now()).toISOString();
    const row: Record<string, unknown> = {
      league: `golf:${this.tour.id}`,
      last_poll_at: at,
      latency_ms: this.now() - started,
      consecutive_failures: this.failures,
      updated_at: at,
    };
    if (error) {
      row.last_error_at = at;
      row.last_error = error;
    } else {
      row.last_ok_at = at;
      row.games = events.length;
      row.live_games = events.filter((e) => e.state === "in").length;
    }
    const { error: e } = await this.db.from("engine_heartbeats").upsert(row, { onConflict: "league" });
    if (e) throw e;
  }
}
