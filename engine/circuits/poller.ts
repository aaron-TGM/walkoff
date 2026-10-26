// One circuit: a golf tour, a tennis tour, a racing series or surfing's
// Championship Tour, where athletes compete for themselves. Its current
// events every 5 minutes while one is under way, every 10 otherwise. The
// field is saved as athletes, and a few bios each poll tell where they were
// born. A winner, or whoever is in contention for the last day, is recorded
// as a result, with their bios read right away, and the towns they're from
// get their moments (lib/hometown), unless HOMETOWN is 0. Each sport adapts
// its feed to this (golf/, tennis/, racing/, surfing/). It keeps no state
// that matters: after a restart a repeat adds nothing. See engine/README.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { athleteId, athletePlace, athletesReady, eventResults, saveAthletes, savePlaces, saveResults, type Athlete, type AthleteResult, type PlaceSource } from "../../lib/athletes";
import { makeHometownMoments } from "../../lib/hometown";
import { nameKey, resolvePlace, type Resolved } from "../../lib/places";
import type { Tour } from "../../lib/tours";
import { birthPlaceText } from "../athletes/feed";
import { errorMessage, log } from "../log";

const MINUTE = 60_000;

export const CIRCUIT_POLL = {
  /** While an event is under way. */
  live: 5 * MINUTE,
  idle: 10 * MINUTE,
  /** Until 009_athletes.sql has run. */
  noTables: 60 * MINUTE,
  /** Bios of the field read each poll, besides the winner's and contenders'. */
  biosPerPoll: 5,
};

/** Someone in an event's field. */
export interface Entrant {
  /** The feed's athlete id: "3470". */
  externalId: string;
  name: string;
}

/** pre: not started. in: under way, between rounds or suspended. final:
 *  done, and only then is there a winner. off: canceled or postponed. */
export type CircuitState = "pre" | "in" | "final" | "off";

export interface CircuitEvent {
  /** "espn:golf:401811941". */
  id: string;
  name: string;
  state: CircuitState;
  /** Where the feed says it is, logged when it changes: the feeds are
   *  undocumented. */
  statusLine: string;
  /** The field, saved as athletes once the event is under way. */
  players: Entrant[];
}

export interface CircuitOutcome {
  kind: "win" | "lead";
  /** The same on every feed that carries the event, so it counts once:
   *  "golf:masters-tournament:2026-04-12". */
  eventKey: string;
  eventName: string;
  players: Entrant[];
  intensity: number;
  /** Contenders: when the deciding round or match starts, which ends their
   *  window. */
  startsAt: string | null;
}

/** Where an athlete was born, as their bio says. */
export interface Bio {
  city: string;
  state: string;
  country: string;
  /** Who says so: ESPN, unless the bio comes from elsewhere. */
  source?: PlaceSource;
  /** The town, when the feed found it already (by coordinates). */
  resolved?: Resolved;
}

/** A sport's feed and rules for one tour or series. */
export interface Circuit<E extends CircuitEvent = CircuitEvent> {
  tour: Tour;
  events(): Promise<E[]>;
  outcomes(e: E, now: number): CircuitOutcome[];
  /** Null when the bio doesn't say. Throws to be asked again later. */
  bio(externalId: string): Promise<Bio | null>;
  /** Walkoff's id for an athlete in the feed: ESPN's, unless the feed
   *  isn't ESPN's. */
  athleteId?(externalId: string): string;
}

export interface CircuitPollerOptions {
  /** Make hometown moments, not just results (HOMETOWN=0 turns them off). */
  hometown: boolean;
  now?: () => number;
  /** lib/places, unless a test swaps it. */
  resolve?: (b: Bio) => Promise<Resolved>;
}

export class CircuitPoller<E extends CircuitEvent = CircuitEvent> {
  readonly tour: Tour;
  private readonly now: () => number;
  /** Events whose field this run has saved. */
  private readonly fields = new Set<string>();
  /** Each event's last status, to log when it changes. */
  private readonly seen = new Map<string, string>();
  private failures = 0;
  private waiting = false;

  constructor(
    private readonly circuit: Circuit<E>,
    private readonly db: SupabaseClient,
    private readonly options: CircuitPollerOptions,
  ) {
    this.tour = circuit.tour;
    this.now = options.now ?? Date.now;
  }

  /** One poll. Never throws. Returns milliseconds until the next. */
  async tick(): Promise<number> {
    const started = this.now();
    try {
      if (!(await athletesReady(this.db))) {
        if (!this.waiting) log("WARNING", `${this.tour.name} is waiting for supabase/009_athletes.sql to run`);
        this.waiting = true;
        return CIRCUIT_POLL.noTables;
      }
      this.waiting = false;
      const events = await this.circuit.events();
      for (const e of events) {
        this.note(e);
        if (e.state === "in" || e.state === "final") await this.saveField(e);
        for (const outcome of this.circuit.outcomes(e, this.now())) await this.record(outcome);
      }
      await this.bios(null);
      this.failures = 0;
      await this.heartbeat(started, events, null);
      return events.some((e) => e.state === "in") ? CIRCUIT_POLL.live : CIRCUIT_POLL.idle;
    } catch (e) {
      this.failures++;
      log("WARNING", `${this.tour.name} poll failed`, { tour: this.tour.id, error: errorMessage(e), consecutiveFailures: this.failures });
      await this.heartbeat(started, [], errorMessage(e)).catch(() => {});
      return Math.min(CIRCUIT_POLL.idle, MINUTE * 2 ** (this.failures - 1));
    }
  }

  private note(e: E): void {
    if (this.seen.get(e.id) === e.statusLine) return;
    this.seen.set(e.id, e.statusLine);
    log("INFO", `${e.name}: ${e.statusLine}`, { tour: this.tour.id, event: e.id, state: e.state });
  }

  /** Walkoff's id for someone in the feed. */
  private idOf(externalId: string): string {
    return this.circuit.athleteId?.(externalId) ?? athleteId(this.tour.sport, externalId);
  }

  private athlete(p: Entrant): Athlete {
    return {
      id: this.idOf(p.externalId),
      sport: this.tour.sport,
      league: this.tour.id,
      externalId: p.externalId,
      displayName: p.name,
      teamId: null,
      position: null,
      jersey: null,
      rosterStatus: null,
      college: null,
    };
  }

  private async saveField(e: E): Promise<void> {
    if (this.fields.has(e.id) || !e.players.length) return;
    await saveAthletes(this.db, e.players.map((p) => this.athlete(p)), new Date(this.now()).toISOString());
    this.fields.add(e.id);
  }

  /** Records who won or is in contention, and makes their towns' moments. */
  private async record(o: CircuitOutcome): Promise<void> {
    const ids = o.players.map((p) => this.idOf(p.externalId));
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
      log("INFO", o.kind === "win" ? `${o.players[0].name} won the ${o.eventName}` : `In contention at the ${o.eventName}: ${o.players.map((p) => p.name).join(", ")}`, {
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

  /** Where athletes were born, from their bios: these ones, or else a few
   *  of the tour's field Walkoff hasn't read yet. A bio that fails is read
   *  again another time. */
  private async bios(ids: string[] | null): Promise<void> {
    let q = this.db.from("athletes").select("id, sport, external_id, display_name").eq("sport", this.tour.sport).eq("league", this.tour.id).is("bio_checked_at", null);
    q = ids ? q.in("id", ids) : q.limit(CIRCUIT_POLL.biosPerPoll);
    const { data, error } = await q;
    if (error) throw error;
    const resolve = this.options.resolve ?? resolvePlace;
    for (const r of (data ?? []) as { id: string; sport: string; external_id: string; display_name: string }[]) {
      let bio;
      try {
        bio = await this.circuit.bio(r.external_id);
      } catch (e) {
        log("WARNING", "Bio unavailable", { athlete: r.id, error: errorMessage(e) });
        continue;
      }
      if (bio) await savePlaces(this.db, [athletePlace(r.id, "birthplace", bio.source ?? "espn", birthPlaceText(bio), bio.resolved ?? (await resolve(bio)))]);
      const at = new Date(this.now()).toISOString();
      const { error: e } = await this.db
        .from("athletes")
        .upsert([{ id: r.id, sport: r.sport, external_id: r.external_id, display_name: r.display_name, name_key: nameKey(r.display_name), bio_checked_at: at, updated_at: at }], { onConflict: "id" });
      if (e) throw e;
    }
  }

  /** One row per tour in engine_heartbeats, "golf:pga" or "racing:f1":
   *  games is the events in the feed, live_games those under way. */
  private async heartbeat(started: number, events: E[], error: string | null): Promise<void> {
    const at = new Date(this.now()).toISOString();
    const row: Record<string, unknown> = {
      league: `${this.tour.sport}:${this.tour.id}`,
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
