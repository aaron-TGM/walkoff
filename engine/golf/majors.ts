// What a golf win is worth. The majors, by name: the feed's own flag is
// compared against these, not trusted. Many events have "Open" or
// "Championship" in their names, and the Scottish Open and the Senior PGA
// aren't majors.
import type { Tour } from "../../lib/tours";

const MAJORS: RegExp[] = [
  /^(the )?masters( tournament)?$/,
  /^pga championship$/,
  /^u\.?s\.? open( championship)?$/,
  /^the (\d+(st|nd|rd|th) )?open( championship)?$/,
  /^open championship$/,
  /^(the )?chevron championship$/,
  /^u\.?s\.? women'?s open( championship)?$/,
  /^kpmg women'?s pga championship$/,
  /^(aig )?women'?s (british )?open$/,
  /^(the )?(amundi )?evian championship$/,
];

/** The PGA Tour's Signature Events and THE PLAYERS. */
const ELEVATED: RegExp[] = [
  /^the sentry$/,
  /^at&t pebble beach pro-am$/,
  /^the genesis invitational$/,
  /^arnold palmer invitational( presented by mastercard)?$/,
  /^the players championship$/,
  /^rbc heritage$/,
  /^truist championship$/,
  /^the memorial tournament( presented by workday)?$/,
  /^travelers championship$/,
  /^fedex st\. jude championship$/,
  /^bmw championship$/,
  /^tour championship$/,
];

const clean = (name: string) => name.trim().toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ");

export const isMajor = (name: string) => MAJORS.some((r) => r.test(clean(name)));
export const isElevated = (name: string) => ELEVATED.some((r) => r.test(clean(name)));

export const GOLF = {
  major: 0.95,
  elevated: 0.85,
  /** Added for a win in a playoff. */
  playoff: 0.05,
  contenderMajor: 0.7,
  contender: 0.55,
  /** A win counts this long after the event's last day starts. */
  winHours: 60,
};

/** A win's intensity, before a playoff. */
export function winIntensity(tour: Tour, name: string): number {
  if (isMajor(name)) return GOLF.major;
  if (tour.id === "pga" && isElevated(name)) return GOLF.elevated;
  return tour.winIntensity;
}
