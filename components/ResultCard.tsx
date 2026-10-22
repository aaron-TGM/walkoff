// Results from an early Walkoff test send, shown in the proof section.
export function ResultCard() {
  return (
    <div className="result-card">
      <div className="result-card-badge">
        <span className="result-card-badge-dot" aria-hidden />
        Early test
      </div>
      <div className="result-card-meta">
        Brand: Frost Buddy &middot; MLB &middot; Win triggers
      </div>
      <div className="result-card-title">7 teams. 7 win-triggered emails.</div>
      <div className="result-card-headline">$5,689 in 7 minutes.</div>
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
          <div className="result-card-stat-num">$0.52</div>
          <div className="result-card-stat-lbl">Rev / recipient</div>
          <div className="result-card-stat-note">Best single send</div>
        </div>
      </div>
      <div className="result-card-attr">
        &ldquo;Free Lid Win.&rdquo; No discount. Just the right email at the
        right moment.
      </div>
    </div>
  );
}
