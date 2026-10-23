// The tools Claude can use in Walkoff, in words for the marketer. Claude
// reads each tool's own description (lib/mcp/tools.ts); this is the help
// center's version. help.test.ts checks the list matches the tools a member
// gets, that each option named here exists, and that "changes" matches the
// tool's read-only hint. Operator tools stay out of public help.

export interface HelpTool {
  /** What it does, for a marketer. */
  summary: string;
  /** Things to ask Claude that use it. */
  asks: string[];
  /** Options worth knowing, by their real argument names. */
  options?: Record<string, string>;
  /** It saves something (a trigger, a log entry) rather than only reading. */
  changes?: true;
}

export const HELP_TOOLS = {
  trigger_queue: {
    summary:
      "Your to-do list: recent moments that match your triggers, or big moments for your standout teams if you have none, that you haven't drafted, sent or skipped. Most urgent first, with how long each is worth acting on.",
    asks: ["What should we send this week?", "Anything we should act on today?"],
    options: { hours: "How far back to look. Default 72." },
  },
  build_campaign: {
    summary:
      "A ready-to-draft campaign for a moment: subject lines, preview text, the email, your products with links and prices, the audience, when to send, the copy rules and the steps to draft it in Klaviyo.",
    asks: ["Build a campaign for the top moment in our queue.", "Show me a sample campaign for a Chargers walk-off."],
    options: {
      moment_id: "The moment, from the queue or recent moments.",
      moment_type: "With a team, a sample before there's a real moment.",
      offer: 'An offer to feature, like "15% off with code BOLT15 through Monday".',
      products: "Your own picks to feature instead of Walkoff's.",
      reach: "Core fans only (the default), or wide to include shared markets.",
    },
  },
  get_affinity_map: {
    summary:
      "Where your customers over-index on fan territories: how strongly, how many customers, what each territory buys more of, and the products to feature there.",
    asks: ["Where are our fans?", "Which teams do our customers follow?"],
  },
  recent_moments: {
    summary:
      "What just happened for your standout teams, or for any team you name: walk-offs, comebacks, rivalry wins and the rest, each with how long it's worth acting on and what you already did with it.",
    asks: ["What happened for our teams this weekend?"],
    options: { team: "Any team, not just your standouts.", hours: "How far back to look. Default 48." },
  },
  upcoming_games: {
    summary: "Games coming up for your standout teams, or one team, in your fans' local time, with rivalries and big games flagged.",
    asks: ["What games are coming up this week?"],
    options: { days: "How far ahead. Default 7." },
  },
  match_products: {
    summary: "Your products to feature for a team: anything made for its fans first, then the colorways closest to its colors, one per team color.",
    asks: ["What should we feature if the Padres win?"],
    options: { limit: "How many products. Default 3." },
  },
  get_territory: {
    summary:
      "A team's fans as a Klaviyo segment: one to three proximity circles, how well they cover the fans, and how many of your customers live there. Claude can create it in Klaviyo for you, once you say OK.",
    asks: ["Set up the Klaviyo segment for Chargers fans."],
    options: { reach: "Core fans only (the default), or wide to include shared markets." },
  },
  create_trigger: {
    summary: "Saves a rule for the moments you want to act on. With no teams it follows your standout territories as they change.",
    asks: ["Make a trigger for walk-off and comeback wins in our top markets."],
    options: {
      moment_types: "Which kinds of moments. Empty means any.",
      teams: "Which teams. Empty means your standout teams.",
      min_intensity: "Skip smaller moments. Walk-offs are about 0.9, close losses 0.5.",
    },
    changes: true,
  },
  list_triggers: {
    summary: "Your saved triggers, or Walkoff's default rule if you haven't saved any.",
    asks: ["What triggers do we have?"],
  },
  delete_trigger: {
    summary: "Deletes one of your triggers. Your send history keeps what it did.",
    asks: ["Delete our rivalry trigger."],
    changes: true,
  },
  log_send: {
    summary: "Records what you did with a moment: drafted, sent or skipped. Logged moments leave your queue and build your history.",
    asks: ["Log it as sent.", "Skip that one."],
    options: { status: "drafted, sent or skipped.", campaign_ref: "The Klaviyo campaign, so the history links to it." },
    changes: true,
  },
  send_history: {
    summary: "What you drafted, sent and skipped, newest first, with the moment behind each.",
    asks: ["What did we send last month?"],
    options: { days: "How far back. Default 30." },
  },
  list_brands: {
    summary: "The brands you can use Walkoff for, with your store, whether you're licensed to name teams, customers mapped, your catalog and your standout teams.",
    asks: ["Which brands can I use in Walkoff?"],
  },
} satisfies Record<string, HelpTool>;

export type ToolName = keyof typeof HELP_TOOLS;

/** The homepage's short list: real tools only, plus what's coming. */
export const HOME_TOOLS: ({ name: ToolName; body: string } | { name: string; body: string; soon: true })[] = [
  { name: "trigger_queue", body: "The moments to act on right now, for the teams your customers follow, most urgent first." },
  {
    name: "build_campaign",
    body: "A ready-to-draft campaign: subject lines, the email, products in the team's colors, the audience and when to send.",
  },
  { name: "get_affinity_map", body: "Which fan territories hold more of your customers than population predicts, and by how much." },
  { name: "match_products", body: "Your own products in each team's colors. No license needed." },
  { name: "get_territory", body: "Each team's fans as a Klaviyo segment. Claude creates it once, with your OK, and every moment reuses it." },
  { name: "create_trigger", body: "Your rules for which moments matter, like walk-off wins in your top markets." },
  { name: "send_history", body: "Everything you drafted, sent and skipped, moment by moment." },
  { name: "benchmarks", body: "How each type of moment performs for brands like yours.", soon: true },
];
