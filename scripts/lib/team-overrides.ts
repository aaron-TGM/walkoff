// Hand-checked facts the feed gets wrong or doesn't have, plus the
// commonly recognized shape of each fan base. Reviewed for the 2026-27
// seasons. Keyed by league, then team abbreviation (pro) or name (college).

/** Where a team really plays when the feed's venue is stale or missing.
 *  US: ZIP or "City, ST". Canada: forward sortation area. */
export const HOME_OVERRIDES: Record<string, Record<string, string>> = {
  nfl: {
    LAR: "90301", // SoFi Stadium, Inglewood (feed still has the Coliseum)
    LAC: "90301", // SoFi Stadium, Inglewood (feed still has Carson)
  },
  nba: {
    GS: "94158", // Chase Center (feed still has Oracle Arena)
    BKN: "11217", // Barclays Center (feed has Newark)
    NY: "10001", // Madison Square Garden
    DET: "Detroit, MI",
    TOR: "CA:M5J", // Scotiabank Arena
  },
  nhl: {
    WPG: "CA:R3B", // Canada Life Centre (feed has the Atlanta Thrashers' arena)
    NJ: "Newark, NJ", // Prudential Center (feed has the IZOD Center)
    NYR: "10001", // Madison Square Garden
    CGY: "CA:T2G",
    EDM: "CA:T5J",
    MTL: "CA:H3B",
    OTT: "CA:K2V",
    TOR: "CA:M5J",
    VAN: "CA:V6B",
  },
  mlb: {
    // Plays in West Sacramento 2025-2027 before Las Vegas, but its fan base
    // is still the East Bay, so its territory stays centered on Oakland.
    ATH: "94621",
    TOR: "CA:M5V", // Rogers Centre
  },
};

/** College homes the schedules can't place, by team name. */
export const COLLEGE_HOMES: Record<string, Record<string, string>> = {
  ncaab: {
    "Alcorn State Braves": "39096", // Lorman, MS is unincorporated
    "West Florida Argonauts": "Pensacola, FL", // new to Division I, no venue in the feed
  },
};

/** Premier League grounds by postcode district (2026-27 clubs). */
export const EPL_GROUNDS: Record<string, string> = {
  ARS: "N5", // Emirates Stadium
  AVL: "B6", // Villa Park
  BHA: "BN1", // Amex Stadium
  BOU: "BH7", // Vitality Stadium
  BRE: "TW8", // Gtech Community Stadium
  CHE: "SW6", // Stamford Bridge
  COV: "CV6", // Coventry Building Society Arena
  CRY: "SE25", // Selhurst Park
  EVE: "L3", // Hill Dickinson Stadium, Bramley-Moore Dock
  FUL: "SW6", // Craven Cottage
  HUL: "HU3", // MKM Stadium
  IPS: "IP1", // Portman Road
  LEE: "LS11", // Elland Road
  LIV: "L4", // Anfield
  MAN: "M16", // Old Trafford
  MNC: "M11", // Etihad Stadium
  NEW: "NE1", // St James' Park
  NFO: "NG2", // City Ground
  SUN: "SR5", // Stadium of Light
  TOT: "N17", // Tottenham Hotspur Stadium
};

/**
 * Fan-base shape. `weight` is relative size where teams share a market
 * (Yankees and Mets both play in New York; the Yankees have more fans).
 * `reach` stretches distance for national brands (Cowboys, Packers,
 * Manchester United). `regions` are states or provinces that treat the team
 * as theirs beyond its own state (the Patriots are New England's team).
 */
export interface FanBase {
  weight?: number;
  reach?: number;
  regions?: string[];
}

const NEW_ENGLAND = ["MA", "NH", "ME", "VT", "RI", "CT"];
const NEW_YORK = ["NY", "NJ"];
const DMV = ["DC", "MD", "VA"];
const PHILLY = ["PA", "NJ", "DE"];
const CAROLINAS = ["NC", "SC"];
const PACIFIC_NW = ["WA", "OR", "AK", "ID", "MT"];
const ROCKIES = ["CO", "WY"];
const UPPER_MIDWEST = ["MN", "ND", "SD"];
const KANSAS_CITY = ["MO", "KS"];
const GULF = ["LA", "MS"];

export const FAN_BASES: Record<string, Record<string, FanBase>> = {
  nfl: {
    DAL: { reach: 1.5 },
    GB: { reach: 1.4 },
    PIT: { reach: 1.3 },
    NE: { reach: 1.2, regions: NEW_ENGLAND },
    KC: { reach: 1.2, regions: KANSAS_CITY },
    SF: { reach: 1.2 },
    NYG: { weight: 1.0, regions: NEW_YORK },
    NYJ: { weight: 0.8, regions: NEW_YORK },
    LAR: { weight: 1.0 },
    LAC: { weight: 0.6 },
    PHI: { regions: PHILLY },
    WSH: { regions: DMV },
    CAR: { regions: CAROLINAS },
    SEA: { regions: PACIFIC_NW },
    DEN: { regions: ROCKIES },
    MIN: { regions: UPPER_MIDWEST },
    NO: { regions: GULF },
  },
  nba: {
    LAL: { weight: 1.6, reach: 1.4 },
    LAC: { weight: 0.5 },
    NY: { weight: 1.4, regions: NEW_YORK },
    BKN: { weight: 0.6, regions: NEW_YORK },
    GS: { reach: 1.3 },
    BOS: { reach: 1.2, regions: NEW_ENGLAND },
    CHI: { reach: 1.2 },
    PHI: { regions: PHILLY },
    WSH: { regions: DMV },
    CHA: { regions: CAROLINAS },
    POR: { regions: ["OR", "WA", "ID"] },
    DEN: { regions: ROCKIES },
    MIN: { regions: UPPER_MIDWEST },
    NO: { regions: GULF },
  },
  nhl: {
    NYR: { weight: 1.2, regions: NEW_YORK },
    NYI: { weight: 0.7, regions: NEW_YORK },
    NJ: { weight: 0.8, regions: NEW_YORK },
    LA: { weight: 1.0 },
    ANA: { weight: 0.7 },
    TOR: { reach: 1.3 },
    MTL: { reach: 1.3 },
    DET: { reach: 1.2 },
    CHI: { reach: 1.2 },
    BOS: { reach: 1.2, regions: NEW_ENGLAND },
    PHI: { regions: PHILLY },
    WSH: { regions: DMV },
    CAR: { regions: CAROLINAS },
    SEA: { regions: PACIFIC_NW },
    COL: { regions: ROCKIES },
    MIN: { regions: UPPER_MIDWEST },
  },
  mlb: {
    NYY: { weight: 1.4, reach: 1.4, regions: NEW_YORK },
    NYM: { weight: 1.0, regions: NEW_YORK },
    CHC: { weight: 1.4, reach: 1.3 },
    CHW: { weight: 0.6 },
    LAD: { weight: 1.6, reach: 1.3 },
    LAA: { weight: 0.6 },
    SF: { weight: 1.2 },
    ATH: { weight: 0.4 },
    BOS: { reach: 1.3, regions: NEW_ENGLAND },
    STL: { reach: 1.2 },
    ATL: { reach: 1.3, regions: ["GA", "AL", "SC", "TN"] },
    PHI: { regions: PHILLY },
    WSH: { regions: DMV },
    KC: { regions: KANSAS_CITY },
    SEA: { regions: PACIFIC_NW },
    COL: { regions: ROCKIES },
    MIN: { regions: UPPER_MIDWEST },
  },
  epl: {
    MAN: { weight: 2.0, reach: 3 },
    LIV: { weight: 2.0, reach: 3 },
    ARS: { weight: 1.6, reach: 2 },
    CHE: { weight: 1.5, reach: 2 },
    MNC: { weight: 1.3, reach: 1.5 },
    TOT: { weight: 1.4, reach: 1.5 },
    NEW: { weight: 1.0, reach: 1.3 },
    AVL: { weight: 0.9 },
    LEE: { weight: 0.9 },
    EVE: { weight: 0.7 },
    NFO: { weight: 0.6 },
    SUN: { weight: 0.6 },
    CRY: { weight: 0.5 },
    BHA: { weight: 0.5 },
    FUL: { weight: 0.4 },
    BRE: { weight: 0.4 },
    IPS: { weight: 0.4 },
    HUL: { weight: 0.4 },
    COV: { weight: 0.4 },
    BOU: { weight: 0.3 },
  },
};

/** College: one member school per power conference, used to find each
 *  conference's id in the feed. Everyone else is a smaller program. */
export const POWER_CONFERENCE_MEMBERS: Record<string, string[]> = {
  ncaaf: ["Alabama Crimson Tide", "Michigan Wolverines", "Texas Tech Red Raiders", "Clemson Tigers"],
  ncaab: [
    "Duke Blue Devils",
    "Michigan Wolverines",
    "Kansas Jayhawks",
    "Kentucky Wildcats",
    "Villanova Wildcats",
  ],
};

/** Power-conference programs draw fans statewide and beyond (reach 2);
 *  other programs mostly locally. */
export const COLLEGE_WEIGHT = {
  power: { weight: 1.0, reach: 2 },
  other: { weight: 0.08, reach: 1 },
} as const;

/** Programs whose following is bigger than their conference suggests. */
export const COLLEGE_OVERRIDES: Record<string, Record<string, FanBase>> = {
  ncaaf: {
    "Notre Dame Fighting Irish": { weight: 1.0, reach: 3 },
    "Boise State Broncos": { weight: 0.4 },
    "Army Black Knights": { weight: 0.3 },
    "Navy Midshipmen": { weight: 0.3 },
  },
  ncaab: {
    "Gonzaga Bulldogs": { weight: 0.8, reach: 2 },
    "Saint Mary's Gaels": { weight: 0.3 },
  },
};
