import Image from "next/image";

// One email per team, each sent the afternoon after that team won, in send
// order. Real products from Frost Buddy's MLB collection
// (frostbuddy.com/collections/mlb): the Gameday edition where there is one,
// and Legacy for the Cardinals, which have no Gameday.
const TEAM_SENDS = [
  { team: "Cubs", img: "cubs", edition: "Gameday", color: "#0e3386" },
  { team: "Dodgers", img: "dodgers", edition: "Gameday", color: "#005a9c" },
  { team: "Yankees", img: "yankees", edition: "Gameday", color: "#0c2340" },
  { team: "Mets", img: "mets", edition: "Gameday", color: "#002d72" },
  { team: "Red Sox", img: "red-sox", edition: "Gameday", color: "#bd3039" },
  { team: "Braves", img: "braves", edition: "Gameday", color: "#ce1141" },
  { team: "Cardinals", img: "cardinals", edition: "Legacy", color: "#c41e3a" },
];

/** Frost Buddy's early test, for the proof card and the hero's one-liner. */
export const RESULT = { brand: "Frost Buddy", sends: TEAM_SENDS.length, revenue: "$9,135" };

// Results from Frost Buddy's early test (the seven "MLB | Free Lid Win"
// campaigns, sent April 6 and 8, 2026), as Frost Buddy's Klaviyo reports them
// with Placed Order conversions, checked November 12, 2026: $9,135.41 from
// 140 orders across 30,787 recipients. Click rate is the average of the seven
// sends' rates (4.8%; pooled it's 4.5%). Revenue per recipient is across all
// seven ($9,135.41 / 30,787 = $0.30), not the best single send.
export function ResultCard() {
  return (
    <div className="result-card">
      <div className="result-card-badge">
        <span className="result-card-badge-dot" aria-hidden />
        Early test
      </div>
      <div className="result-card-meta">
        {RESULT.brand} &middot; Licensed brand &middot; MLB win triggers
      </div>
      <div className="result-card-title">
        {RESULT.sends} teams. {RESULT.sends} win-triggered emails.
      </div>
      <div className="result-card-headline">{RESULT.revenue} in revenue.</div>
      <div className="result-card-sends-label">
        One email per team, the afternoon after the win
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
                alt={`Frost Buddy Universal Buddy, ${t.team} ${t.edition}`}
                width={309}
                height={360}
                sizes="96px"
              />
            </div>
            <b>Universal Buddy</b>
            <span>{t.team} {t.edition}</span>
            <span className="team-send-offer">Free lid with the win</span>
          </div>
        ))}
      </div>
      <div className="result-card-stats">
        <div>
          <div className="result-card-stat-num">30.8K</div>
          <div className="result-card-stat-lbl">Recipients</div>
          <div className="result-card-stat-note">7 team segments</div>
        </div>
        <div>
          <div className="result-card-stat-num">4.8%</div>
          <div className="result-card-stat-lbl">Click rate</div>
          <div className="result-card-stat-note">Avg across 7 sends</div>
        </div>
        <div>
          <div className="result-card-stat-num">$0.30</div>
          <div className="result-card-stat-lbl">Rev / recipient</div>
          <div className="result-card-stat-note">Across all 7 sends</div>
        </div>
      </div>
      <div className="result-card-attr">
        The offer: a free lid with a team Buddy for 48 hours, no code needed.
        Nothing marked down. Revenue as Klaviyo attributed it.
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
