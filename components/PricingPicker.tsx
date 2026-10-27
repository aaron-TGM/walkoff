"use client";

import { useState } from "react";
import { leagueSport, SportIcon } from "@/components/SportIcon";
import { LEAGUES } from "@/lib/leagues";
import { PRICING, annualMonthlyPrice, monthlyPrice } from "@/lib/pricing";

const INCLUDED = [
  "Every trigger in every league you pick",
  "Hometown moments, whatever leagues you pick",
  "Your fan map and product matching",
  "Works in Claude, with your Shopify and Klaviyo",
  "Setup done for you during early access",
  "Every new moment category as it launches",
  "Holdout results and benchmarks as they launch",
];

export function PricingPicker() {
  const [selected, setSelected] = useState<string[]>(["nfl"]);
  const count = selected.length;
  const allSelected = count === LEAGUES.length;

  function toggle(id: string) {
    setSelected((cur) => {
      if (!cur.includes(id)) return [...cur, id];
      // Keep at least one league picked.
      return cur.length > 1 ? cur.filter((x) => x !== id) : cur;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? ["nfl"] : LEAGUES.map((l) => l.id));
  }

  return (
    <div className="pricing-picker">
      <div className="pricing-tier">&mdash; Your plan</div>
      <div className="pricing-name">Pick your leagues</div>

      <div className="chip-row" role="group" aria-label="Leagues">
        {LEAGUES.map((l) => {
          const on = selected.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              className={`chip${on ? " chip-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(l.id)}
            >
              <SportIcon sport={leagueSport(l)} />
              {l.name}
              {l.note ? <span className="chip-note">{l.note}</span> : null}
            </button>
          );
        })}
        <button
          type="button"
          className={`chip chip-all${allSelected ? " chip-on" : ""}`}
          aria-pressed={allSelected}
          onClick={toggleAll}
        >
          All leagues
        </button>
      </div>

      <div className="pricing-picker-price" aria-live="polite">
        <div className="pricing-price">
          ${monthlyPrice(count)}
          <span className="pricing-freq">/mo per brand</span>
        </div>
        <div className="pricing-billed">
          {count} {count === 1 ? "league" : "leagues"} &middot; $
          {annualMonthlyPrice(count)}/mo billed yearly
        </div>
        <div className="pricing-rule">
          ${PRICING.firstLeague} for your first league, ${PRICING.extraLeague}{" "}
          for each one after, ${PRICING.allLeagues} for every league.
        </div>
      </div>

      <ul className="pricing-features">
        {INCLUDED.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <a href="#form" className="btn-green block text-center" data-cta="pricing">
        <span>Get early access</span>
      </a>
      <p className="pricing-cta-note">
        {PRICING.trialDays} days free &middot; No credit card
      </p>
    </div>
  );
}
