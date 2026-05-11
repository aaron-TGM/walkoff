"use client";

import { useEffect, useRef, useState } from "react";

function getYesterdayFormatted(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayName = days[d.getDay()];
  const month = months[d.getMonth()];
  const date = d.getDate();
  const suffix =
    date === 1 || date === 21 || date === 31 ? "st" :
    date === 2 || date === 22 ? "nd" :
    date === 3 || date === 23 ? "rd" : "th";
  return `${dayName}, ${month} ${date}${suffix}`;
}

export function HeroCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [yesterday, setYesterday] = useState("");

  useEffect(() => {
    setYesterday(getYesterdayFormatted());
  }, []);

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
        LIVE RESULTS
      </div>
      <div className="hero-card-meta">
        Brand: Frost Buddy &middot; MLB &middot; {yesterday}
      </div>
      <div className="hero-card-title">
        7 teams. 7 win-triggered emails.
      </div>
      <div className="hero-card-result-headline">$5,689 in 7 minutes.</div>
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
        &ldquo;Free Lid Win.&rdquo; No discount. Just the right email at the right moment.
      </div>
    </div>
  );
}
