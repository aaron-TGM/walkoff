// Flat price per brand, scaled only by how many leagues it wants.
// Every trigger, category and feature is included at every price.
export const PRICING = {
  firstLeague: 149,
  extraLeague: 50,
  allLeagues: 399,
  annualDiscount: 0.2,
  trialDays: 60,
} as const;

export function monthlyPrice(leagueCount: number): number {
  if (leagueCount <= 0) return 0;
  const price =
    PRICING.firstLeague + PRICING.extraLeague * (leagueCount - 1);
  return Math.min(price, PRICING.allLeagues);
}

export function annualMonthlyPrice(leagueCount: number): number {
  return Math.round(monthlyPrice(leagueCount) * (1 - PRICING.annualDiscount));
}
