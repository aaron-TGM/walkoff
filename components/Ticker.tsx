const ITEMS: { tag: string; headline: string; detail: string }[] = [
  {
    tag: "Final/OT",
    headline: "Eagles 27, Cowboys 24",
    detail: "2,310 customers in Eagles territory · 4 products matched",
  },
  {
    tag: "Derby win",
    headline: "Arsenal 2, Spurs 1",
    detail: "North London · Home-kit colors flagged",
  },
  {
    tag: "First freeze",
    headline: "Twin Cities, Saturday",
    detail: "3,902 customers · Blankets and beanies",
  },
  {
    tag: "Buzzer beater",
    headline: "Celtics 112, Knicks 110",
    detail: "Fired 2m 14s after the final",
  },
  {
    tag: "Rivalry in 48h",
    headline: "Michigan at Ohio State",
    detail: "Pre-game email waiting for approval",
  },
  {
    tag: "Tour stop",
    headline: "3 nights in Chicago",
    detail: "1,140 customers within 30 miles",
  },
  {
    tag: "Playoff clinch",
    headline: "Oilers lock a spot",
    detail: "Edmonton · Limited drop queued",
  },
];

function TickerGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="ticker-group" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <span key={item.tag + item.headline} className="ticker-item">
          <span className="ticker-dot" aria-hidden />
          <span className="ticker-tag">{item.tag}</span>
          <span className="ticker-headline">{item.headline}</span>
          <span className="ticker-detail">{item.detail}</span>
        </span>
      ))}
    </div>
  );
}

export function Ticker() {
  return (
    <div className="ticker" role="marquee" aria-label="Sample moment feed">
      <div className="ticker-label">Sample feed</div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          <TickerGroup />
          <TickerGroup hidden />
        </div>
      </div>
    </div>
  );
}
