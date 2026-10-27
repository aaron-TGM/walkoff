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
  /** It saves something (a catalog, counts, a trigger, a log entry) rather
   *  than only reading. */
  changes?: true;
}

export const HELP_TOOLS = {
  import_catalog: {
    summary:
      "Reads your products from your Shopify store's public product feed: titles, types, tags, descriptions, prices, colorways, SKUs and photos. New products are added and the rest updated. No customer data.",
    asks: ["Set up Walkoff from our Shopify store.", "Update our catalog from the store."],
    changes: true,
  },
  import_customer_counts: {
    summary:
      "Makes your fan map from customer counts Claude reads in Shopify's analytics: customers by postal code, and by state or province. Walkoff keeps only each code's area and the count.",
    asks: ["Refresh our fan map from Shopify."],
    options: { regions: "The second query's state and province totals. They place the customers outside your top postal codes." },
    changes: true,
  },
  trigger_queue: {
    summary:
      "Your to-do list: recent moments that match your triggers, that you haven't drafted, sent or skipped. With no triggers of your own, big moments for your standout teams, and hometown moments in towns near your customers. Most urgent first, with how long each is worth acting on.",
    asks: ["What should we send this week?", "Anything we should act on today?"],
    options: { hours: "How far back to look. Default 72." },
  },
  build_campaign: {
    summary:
      "A ready-to-draft campaign for a moment: subject lines, preview text, the email, your products with links and prices, the audience, when to send, the copy rules and the steps to draft it in Klaviyo. For a hometown moment, the audience is one circle around the town.",
    asks: ["Build a campaign for the top moment in our queue.", "Show me a sample campaign for a Chargers walk-off."],
    options: {
      moment_id: "The moment, from the queue or recent moments.",
      moment_type: "With a team, a sample before there's a real moment.",
      offer: 'An offer to feature, like "15% off with code BOLT15 through Monday".',
      products: "Your own picks to feature instead of Walkoff's.",
      reach: "Core fans only (the default), or wide to include shared markets.",
      town: 'With a hometown moment type, a sample for a town, like "San Clemente, CA".',
      radius_miles: "For a hometown moment, a tighter or wider circle around the town, in miles.",
    },
  },
  get_affinity_map: {
    summary:
      "Where your customers over-index on fan territories: how strongly, how many customers, what each territory buys more of, and the products to feature there.",
    asks: ["Where are our fans?", "Which teams do our customers follow?"],
  },
  local_athletes: {
    summary:
      "Athletes Walkoff follows who are from towns near your customers, town by town: about how many of your customers live there, and for each athlete their team, position and how Walkoff knows where they're from. The names are for you. Campaigns celebrate the town and never name an athlete without the athlete's written OK.",
    asks: ["Which athletes are from near our customers?", "Who's from the towns where our customers live?"],
    options: { limit: "How many towns to show. Default 20." },
  },
  recent_moments: {
    summary:
      "What just happened for your standout teams, or for any team you name, and in towns near your customers: walk-offs, comebacks, rivalry wins, hometown wins and the rest, each with how long it's worth acting on and what you already did with it.",
    asks: ["What happened for our teams this weekend?", "Did anyone from our customers' towns win this week?"],
    options: {
      team: "Any team, not just your standouts.",
      hours: "How far back to look. Default 48.",
      scope: "Teams, towns or both.",
    },
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
      towns: 'For hometown moments in and near these towns, like "San Clemente, CA". A trigger with towns takes only hometown moments.',
      min_local_customers: "How many of your customers a town needs, estimated, for its hometown moments to count.",
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
    options: {
      status: "drafted, sent or skipped.",
      campaign_ref: "The Klaviyo campaign id, so the history links to it and Claude can read how it did.",
    },
    changes: true,
  },
  send_history: {
    summary:
      "What you drafted, sent and skipped, newest first, with the moment and the Klaviyo campaign behind each. Claude reads how each did from Klaviyo: recipients, clicks, orders and revenue.",
    asks: ["What did we send last month?", "How did our Walkoff sends do last month?"],
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
  { name: "trigger_queue", body: "The moments to act on right now, for your standout teams and towns, most urgent first." },
  {
    name: "build_campaign",
    body: "A ready-to-draft campaign: subject lines, the email, products in the team's colors, the audience and when to send.",
  },
  { name: "get_affinity_map", body: "Which fan territories hold more of your customers than population predicts, and by how much." },
  { name: "match_products", body: "Your own products in each team's colors. No license needed." },
  { name: "get_territory", body: "Each team's territory as a Klaviyo segment. Claude creates it once, with your OK, and every moment reuses it." },
  { name: "create_trigger", body: "Your rules for which moments matter, like walk-off wins in your top markets." },
  { name: "send_history", body: "Everything you drafted, sent and skipped, moment by moment, and how each did in Klaviyo." },
  { name: "benchmarks", body: "How each type of moment performs for brands like yours.", soon: true },
];
