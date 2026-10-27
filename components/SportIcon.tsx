// Small line drawings of each sport's ball or gear, for where the site names
// a league or tour. Drawn here on purpose: no league logos, the same way the
// emails use no team logos.
import type { League } from "@/lib/leagues";

const ICONS: Record<string, React.ReactNode> = {
  football: (
    <>
      <path d="M4 20C4 10.5 10.5 4 20 4c0 9.5-6.5 16-16 16Z" />
      <path d="M9 15l6-6M10.5 10.5l3 3M12.5 8.5l3 3M8.5 12.5l3 3" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" />
    </>
  ),
  hockey: (
    <>
      <ellipse cx="12" cy="9.5" rx="8" ry="3.5" />
      <path d="M4 9.5v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5" />
    </>
  ),
  soccer: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.5l3.3 2.4-1.3 3.9h-4l-1.3-3.9ZM12 8.5V3.5M15.3 10.9l4.5-1.6M14 14.8l2.8 3.9M10 14.8l-2.8 3.9M8.7 10.9l-4.5-1.6" />
    </>
  ),
  baseball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.2 5.2c2.6 3.6 2.6 10 0 13.6M17.8 5.2c-2.6 3.6-2.6 10 0 13.6" />
    </>
  ),
  golf: <path d="M8 21V3l9 3.5L8 10M3.5 21h9" />,
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.3 10.3A9 9 0 0 1 13.7 20.7M10.3 3.3a9 9 0 0 0 10.4 10.4" />
    </>
  ),
  racing: (
    <>
      <path d="M5 21V4h14v9H5" />
      <path d="M5 4h3.5v3H5ZM12 4h3.5v3H12ZM8.5 7H12v3H8.5ZM15.5 7H19v3h-3.5ZM5 10h3.5v3H5ZM12 10h3.5v3H12Z" fill="currentColor" stroke="none" />
    </>
  ),
  surfing: <path d="M3 12c0-4.4 3.3-8 7.5-8 3 0 5 2 5 4.5 0 1.9-1.5 3.5-3.5 3.5-1.4 0-2.5-1-2.5-2.3M2 16c2.5 0 3.5-2 6-2s3.5 2 6 2 3.5-2 6-2M2 20c2.5 0 3.5-2 6-2s3.5 2 6 2 3.5-2 6-2" />,
};

/** The sport a league plays, from its feed: "football/nfl" is football. */
export const leagueSport = (l: League) => l.feedPath.split("/")[0];

/** sport: "football", "golf", "Surfing". Nothing for a sport without one. */
export function SportIcon({ sport }: { sport: string }) {
  const icon = ICONS[sport.toLowerCase()];
  if (!icon) return null;
  return (
    <svg className="sport-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {icon}
    </svg>
  );
}
