// Klaviyo's side of the setup, from Klaviyo's own docs. Klaviyo owns these
// steps, so the guide says when they were checked and links Klaviyo's pages
// for the latest.
import { KLAVIYO_TOOLS } from "../mcp/campaign";

export const KLAVIYO = {
  checked: "October 2026",
  /** Klaviyo's remote MCP server, for a custom connector. */
  mcpUrl: "https://mcp.klaviyo.com/mcp",
  /** Klaviyo roles that can connect it. */
  roles: ["Owner", "Admin", "Manager"],
  /** Claude plans that can add custom connectors. */
  customPlans: ["Pro", "Max", "Team", "Enterprise"],
  /** Klaviyo's cap on segments created per day
   *  (developers.klaviyo.com/en/reference/segments_api_overview). */
  segmentsPerDay: 100,
  docs: {
    connect: "https://developers.klaviyo.com/en/docs/connect_to_the_klaviyo_mcp_server",
    tools: "https://developers.klaviyo.com/en/docs/klaviyo_mcp_server_available_tools",
    agencies: "https://help.klaviyo.com/hc/en-us/articles/52833598880923",
    location: "https://help.klaviyo.com/hc/en-us/articles/115005065887",
    utm: "https://help.klaviyo.com/hc/en-us/articles/115005247808",
  },
} as const;

/** Tracking Walkoff's sends with what a brand already has: Klaviyo's UTM
 *  parameters, which Shopify, Google Analytics and Triple Whale read. */
export const TRACKING = {
  /** Where UTM tracking lives in Klaviyo, under the account name. */
  utmSettings: "Settings → Other → UTM tracking",
  /** A campaign's own switch for it, in Klaviyo's campaign editor. */
  campaignSwitch: "Include tracking parameters",
  tripleWhale: {
    setup: "https://kb.triplewhale.com/en/articles/5740620-klaviyo-integration",
    differences: "https://triplewhale.readme.io/docs/why-is-my-klaviyo-or-emailsms-revenue-in-triple-whale-different-from-the-klaviyo-dashboard",
  },
} as const;

/** What Claude does in Klaviyo for a campaign, in order. The tool names are
 *  the ones Walkoff's drafting steps use (help.test.ts checks), plus
 *  Klaviyo's send tool, which Claude uses only on the marketer's go-ahead. */
export const KLAVIYO_FLOW: { step: string; tools: string[]; changes: string }[] = [
  { step: "Finds the team's segment by its name", tools: [KLAVIYO_TOOLS.findSegment], changes: "Nothing" },
  {
    step: "Creates the segment the first time, once you say OK",
    tools: [KLAVIYO_TOOLS.createSegment],
    changes: "Adds a segment",
  },
  { step: "Creates the email template from Walkoff's email", tools: [KLAVIYO_TOOLS.createTemplate], changes: "Adds a template" },
  {
    step: "Creates a draft campaign for the segment, with the subject, preview text and UTM tracking",
    tools: [KLAVIYO_TOOLS.createCampaign, KLAVIYO_TOOLS.assignTemplate],
    changes: "Adds a draft",
  },
  { step: "Shows you the email", tools: [KLAVIYO_TOOLS.render], changes: "Nothing" },
  { step: "Sends or schedules it, only when you say go", tools: ["send_campaign"], changes: "Sends it" },
  { step: "Reads how it did, when you ask", tools: [KLAVIYO_TOOLS.report], changes: "Nothing" },
];
