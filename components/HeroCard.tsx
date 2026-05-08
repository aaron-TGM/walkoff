"use client";

import { useEffect, useRef } from "react";

export function HeroCard() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const y = window.pageYOffset;
          if (y < window.innerHeight * 1.5) {
            card.style.transform = `translateY(${y * 0.07}px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="hero-card" ref={cardRef}>
      <div className="hero-card-badge">
        <span className="hero-card-badge-dot" aria-hidden />
        Live Results
      </div>
      <div className="hero-card-meta">
        Frost Buddy &middot; MLB &middot; April 2026
      </div>
      <div className="hero-card-title">
        7 teams. 7 win-triggered emails.
      </div>
      <div className="hero-card-result-headline">$5,689 in one week.</div>
      <div className="hero-card-stats">
        <div>
          <div className="hero-card-stat-num">16K</div>
          <div className="hero-card-stat-lbl">Recipients</div>
          <div className="hero-card-stat-note">7 team segments</div>
        </div>
        <div>
          <div className="hero-card-stat-num">6.7%</div>
          <div className="hero-card-stat-lbl">Click Rate</div>
          <div className="hero-card-stat-note">Avg across 7 sends</div>
        </div>
        <div>
          <div className="hero-card-stat-num">$0.52</div>
          <div className="hero-card-stat-lbl">Rev / Recipient</div>
          <div className="hero-card-stat-note">Best single send</div>
        </div>
      </div>
      <div className="hero-card-attr">
        &ldquo;Free Lid Win&rdquo; &mdash; No discount. Just the right email at
        the right moment.
      </div>
    </div>
  );
}
