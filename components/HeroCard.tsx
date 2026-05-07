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
        Trigger Fired
      </div>
      <div className="hero-card-meta">
        LAD vs SF &middot; Apr 6, 2026 &middot; 2:28 PM ET
      </div>
      <div className="hero-card-title">Free Lid Win — Dodgers</div>
      <div className="hero-card-sub">
        MLB SHOPPER &middot; DODGERS &middot; 2,813 RECIPIENTS
      </div>
      <div className="hero-card-stats">
        <div>
          <div className="hero-card-stat-num">$1,450</div>
          <div className="hero-card-stat-lbl">Attributed</div>
          <div className="hero-card-stat-note">Single send</div>
        </div>
        <div>
          <div className="hero-card-stat-num">39%</div>
          <div className="hero-card-stat-lbl">Open Rate</div>
          <div className="hero-card-stat-note">↑ vs 20% avg</div>
        </div>
        <div>
          <div className="hero-card-stat-num">3.1%</div>
          <div className="hero-card-stat-lbl">Click Rate</div>
          <div className="hero-card-stat-note">225 clicks</div>
        </div>
      </div>
    </div>
  );
}
