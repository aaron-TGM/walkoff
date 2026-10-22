// Incident log for walkoff.io/status. Add the newest incident first.
export interface Incident {
  /** ISO date, e.g. "2026-11-02". */
  date: string;
  title: string;
  status: "investigating" | "monitoring" | "resolved";
  body: string;
}

export const INCIDENTS: Incident[] = [];
