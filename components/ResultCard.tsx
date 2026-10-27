import Image from "next/image";

// One email per team, each sent the night that team won. Real products from
// Frost Buddy's MLB collection (frostbuddy.com/collections/mlb).
const TEAM_SENDS = [
  { team: "Dodgers", img: "dodgers", color: "#005a9c" },
  { team: "Yankees", img: "yankees", color: "#0c2340" },
  { team: "Cubs", img: "cubs", color: "#0e3386" },
  { team: "Red Sox", img: "red-sox", color: "#bd3039" },
  { team: "Braves", img: "braves", color: "#ce1141" },
  { team: "Phillies", img: "phillies", color: "#e81828" },
  { team: "Giants", img: "giants", color: "#fd5a1e" },
];

// Results from an early Walkoff test, shown in the proof section. Revenue per
// recipient is across all 7 sends ($5,689 over 16K recipients), like the
// click rate, not the best single send.
export function ResultCard() {
  return (
    <div className="result-card">
      <div className="result-card-badge">
        <span className="result-card-badge-dot" aria-hidden />
        Early test
      </div>
      <div className="result-card-meta">
        Frost Buddy &middot; Licensed brand &middot; MLB win triggers
      </div>
      <div className="result-card-title">7 teams. 7 win-triggered emails.</div>
      <div className="result-card-headline">$5,689 in revenue.</div>
      <div className="result-card-sends-label">
        One email per team, the night they won
      </div>
      <div className="result-card-sends" tabIndex={0} aria-label="The seven team emails, scrollable">
        {TEAM_SENDS.map((t) => (
          <div key={t.team} className="team-send" style={{ borderTopColor: t.color }}>
            <div className="team-send-final">
              <span>Final</span>
              {t.team}
            </div>
            <div className="team-send-shot">
              <Image
                src={`/examples/frostbuddy/${t.img}.webp`}
                alt={`Frost Buddy Universal Buddy, ${t.team} Gameday`}
                width={309}
                height={360}
                sizes="96px"
              />
            </div>
            <b>Universal Buddy</b>
            <span>{t.team} Gameday</span>
            <span className="team-send-offer">Free lid with the win</span>
          </div>
        ))}
      </div>
      <div className="result-card-stats">
        <div>
          <div className="result-card-stat-num">16K</div>
          <div className="result-card-stat-lbl">Recipients</div>
          <div className="result-card-stat-note">7 team segments</div>
        </div>
        <div>
          <div className="result-card-stat-num">6.7%</div>
          <div className="result-card-stat-lbl">Click rate</div>
          <div className="result-card-stat-note">Avg across 7 sends</div>
        </div>
        <div>
          <div className="result-card-stat-num">$0.36</div>
          <div className="result-card-stat-lbl">Rev / recipient</div>
          <div className="result-card-stat-note">Across all 7 sends</div>
        </div>
      </div>
      <div className="result-card-attr">
        The offer: a free lid with the win. Nothing marked down. Revenue as
        Klaviyo attributed it.
      </div>
      <p className="result-card-note">
        Frost Buddy is licensed, so its emails show the team. Without a
        license, Walkoff features your own products in the team&apos;s colors
        instead. MLB plans start on Opening Day 2027; the same win triggers
        run today for NFL, NBA, NHL, NCAA and Premier League teams.
      </p>
    </div>
  );
}
