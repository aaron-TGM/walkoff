// Example conversations for the help pages. help.test.ts checks every tool
// they show is one a member really has.

export interface SessionLine {
  kind: "user" | "tool" | "out" | "ok";
  /** For a tool line, the tool's name. */
  text: string;
  note?: string;
}

export const SESSIONS: Record<"setup" | "week" | "trigger", { title: string; lines: SessionLine[] }> = {
  setup: {
    title: "claude · walkoff + shopify",
    lines: [
      { kind: "user", text: "Set up Walkoff from our Shopify store." },
      { kind: "tool", text: "import_catalog" },
      { kind: "out", text: "412 products read from the store · 1,180 colorways" },
      { kind: "out", text: "Shopify analytics: customers by postal code, and by state" },
      { kind: "tool", text: "import_customer_counts" },
      { kind: "out", text: "18,240 customers mapped · 64% placed by their postal code" },
      { kind: "tool", text: "get_affinity_map" },
      { kind: "ok", text: "Your standouts: Chargers 2.4x, Padres 1.9x, Kings 1.6x" },
    ],
  },
  week: {
    title: "claude · walkoff + klaviyo",
    lines: [
      { kind: "user", text: "What should we send this week?" },
      { kind: "tool", text: "trigger_queue" },
      { kind: "out", text: "Walk-off win: Chargers 27, Chiefs 24 · about 28 hours left" },
      { kind: "out", text: "The Game: Michigan at Ohio State · until kickoff" },
      { kind: "user", text: "Build the first one." },
      { kind: "tool", text: "build_campaign" },
      { kind: "out", text: "Subject: Azure and sunflower kind of Sunday." },
      { kind: "out", text: "Audience: Walkoff · Los Angeles Chargers fans · Send: Sun 4:46 PM PDT" },
      { kind: "user", text: "Looks good. Draft it in Klaviyo." },
      { kind: "out", text: "Klaviyo: template and draft campaign created" },
      { kind: "user", text: "Sent it. Log it." },
      { kind: "tool", text: "log_send", note: "sent" },
      { kind: "ok", text: "Logged. It's off your queue." },
    ],
  },
  trigger: {
    title: "claude · walkoff",
    lines: [
      { kind: "user", text: "Make a trigger for walk-off and comeback wins in our top markets." },
      { kind: "tool", text: "create_trigger" },
      { kind: "ok", text: "Saved: Big wins in our top markets" },
      { kind: "user", text: "What games are coming up?" },
      { kind: "tool", text: "upcoming_games", note: "next 7 days" },
      { kind: "out", text: "SUN 1:25 PM · Chiefs at Chargers · rivalry" },
    ],
  },
};
