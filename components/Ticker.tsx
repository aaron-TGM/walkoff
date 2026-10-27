const ITEMS: { tag: string; headline: string; detail: string }[] = [
  {
    tag: "Final/OT",
    headline: "Eagles 27, Cowboys 24",
    detail: "1,640 customers in Eagles territory · 4 products matched",
  },
  {
    tag: "Derby win",
    headline: "Arsenal 2, Spurs 1",
    detail: "North London · Red and white products matched",
  },
  {
    tag: "Hometown title",
    headline: "San Clemente, CA",
    detail: "412 customers within 5 miles · Campaign ready",
  },
  {
    tag: "Walk-off win",
    headline: "Padres 4, Dodgers 3",
    detail: "1,880 customers in Padres territory · Campaign ready",
  },
  {
    tag: "Buzzer beater",
    headline: "Celtics 112, Knicks 110",
    detail: "In your queue a minute after the final",
  },
  {
    tag: "Rivalry in 48h",
    headline: "Michigan at Ohio State",
    detail: "Pre-game email waiting for approval",
  },
  {
    tag: "Comeback win",
    headline: "Packers 31, Bears 28",
    detail: "Down 14, won it late · Green and gold products ready",
  },
  {
    tag: "Series win",
    headline: "Oilers advance",
    detail: "Edmonton · Playoff email drafted, waiting on you",
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

// The pause control is CSS only: the checkbox stops the track and swaps the
// label (.ticker-pause in globals.css).
export function Ticker() {
  return (
    <div className="ticker" role="marquee" aria-label="Sample moment feed">
      <div className="ticker-label">Sample feed</div>
      <input id="ticker-pause" type="checkbox" className="ticker-pause-input sr-only" aria-label="Pause the sample feed" />
      <div className="ticker-viewport">
        <div className="ticker-track">
          <TickerGroup />
          <TickerGroup hidden />
        </div>
      </div>
      <label htmlFor="ticker-pause" className="ticker-pause" aria-hidden>
        <span className="ticker-pause-off">Pause</span>
        <span className="ticker-pause-on">Play</span>
      </label>
    </div>
  );
}
