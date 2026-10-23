// When to send: in the team's own time zone, never late at night. A win at
// 7:41 PM goes out now; one at 11:30 PM waits for 8 AM.
import type { TeamHome } from "../affinity/geo";

const US: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver", PR: "America/Puerto_Rico",
};
const CA: Record<string, string> = {
  AB: "America/Edmonton", BC: "America/Vancouver", MB: "America/Winnipeg", NB: "America/Moncton",
  NL: "America/St_Johns", NS: "America/Halifax", ON: "America/Toronto", PE: "America/Halifax",
  QC: "America/Toronto", SK: "America/Regina",
};

export function teamTimeZone(team: Pick<TeamHome, "country" | "region">): string {
  if (team.country === "GB") return "Europe/London";
  if (team.country === "CA") return CA[team.region] ?? "America/Toronto";
  return US[team.region] ?? "America/New_York";
}

interface LocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

export function localTime(date: Date, tz: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "long",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

/** The UTC instant of a wall-clock time in a time zone. */
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall;
  for (let i = 0; i < 2; i++) {
    const l = localTime(new Date(utc), tz);
    utc += wall - Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);
  }
  return new Date(utc);
}

/** "Sun 4:12 PM PDT", "Mon 8:00 AM BST". */
export function formatLocal(date: Date, tz: string): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(",", "");
  // en-US names British time "GMT+1"; en-GB calls it BST.
  const zone = new Intl.DateTimeFormat(tz.startsWith("Europe/") ? "en-GB" : "en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  return zone ? `${time} ${zone}` : time;
}

export interface SendTiming {
  /** "Sun 4:12 PM PDT" */
  send_at_local: string;
  send_at_utc: string;
  timezone: string;
  why: string;
}

/** Sends go out between 8 AM and 9 PM where the fans live. */
export const SEND_HOURS = { earliest: 8, latest: 21 } as const;

/** After a result: send now if it's a decent hour where the fans are, else
 *  at 8 AM. Before a game: the morning of game day, or now if that's past. */
export function sendTiming(opts: { phase: string; occurredAt: Date; gameStart?: Date | null; tz: string; now: Date }): SendTiming {
  const { tz, now } = opts;
  const at = (date: Date, why: string): SendTiming => ({
    send_at_local: formatLocal(date, tz),
    send_at_utc: date.toISOString(),
    timezone: tz,
    why,
  });
  const morningOf = (date: Date, addDays = 0) => {
    const l = localTime(date, tz);
    return zonedTime(l.year, l.month, l.day + addDays, SEND_HOURS.earliest, 0, tz);
  };

  if (opts.phase === "before" && opts.gameStart) {
    const morning = morningOf(opts.gameStart);
    const hourBefore = new Date(opts.gameStart.getTime() - 3 * 3600_000);
    const best = morning.getTime() > now.getTime() ? morning : hourBefore.getTime() > now.getTime() ? now : null;
    if (best === morning) return at(morning, "The morning of game day, while fans are planning their day.");
    if (best) return at(now, "Game day is already here: send now, well before kickoff.");
    return at(now, "Kickoff is close: send now or skip, since the pre-game window is closing.");
  }

  const ref = opts.occurredAt.getTime() > now.getTime() ? opts.occurredAt : now;
  const h = localTime(ref, tz).hour;
  if (h >= SEND_HOURS.earliest && h < SEND_HOURS.latest) {
    return at(ref, "Right away: fans are still buzzing, and it's a decent hour where they live.");
  }
  const next = h >= SEND_HOURS.latest ? morningOf(ref, 1) : morningOf(ref);
  return at(next, "It ended late where the fans live, so the morning after, at 8 AM local time.");
}
