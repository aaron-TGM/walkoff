// The Walkoff MCP server, built fresh for each request (the /mcp route is
// stateless) for the person the access token belongs to.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SHOPIFY_TOOLS, SHOPIFYQL } from "../affinity/shopify-counts";
import { helpUrl } from "../help/pages";
import { hometownLive } from "../hometown/flag";
import { KLAVIYO_TOOLS } from "./campaign";
import { isOperator } from "./data";
import { hometownOn, registerTools, type ToolContext } from "./tools";

export const SERVER_INFO = { name: "walkoff", title: "Walkoff", version: "1.0.0" };

export const INSTRUCTIONS = `Walkoff turns sports moments into ready-made campaigns for brands whose customers are fans. It knows each brand's fan territories (from its own customer data), its catalog by color, and live moments from every game in its leagues: walk-off wins, buzzer beaters, comebacks, rivalry wins, heartbreakers, series wins and titles, rivalry and big-game previews.

Setup, once per brand, with the marketer's Shopify connector and no files (list_brands shows setup_needed):
1. import_catalog: Walkoff reads the products from the store's public product feed.
2. Run these two queries with the Shopify connector's ${SHOPIFY_TOOLS.analytics}, exactly as written:
   ${SHOPIFYQL.postalCodes}
   ${SHOPIFYQL.regions}
3. import_customer_counts, with the first query's rows as postal_codes and the second's as regions, one row per line (country, postal code or state, customers), every row in one call.
4. get_affinity_map, to show the marketer their standout teams.
Counts only: never read, ask for or pass on customers' names, emails, phone numbers or addresses, and don't use the Shopify connector's customer or order tools for this. If a query fails, fix only its syntax and keep its columns. If the tool returns only part of the rows, page with OFFSET and pass them all together. A store not on Shopify, or no Shopify connector: the marketer uploads files with the link in their welcome email.

The usual flow:
1. list_brands (if a brand shows setup_needed, run Setup first), then trigger_queue for the moments to act on now.
2. build_campaign with a moment_id: subject lines, preview text, a finished email, products, the audience and when to send.
3. With the marketer's Klaviyo connector: find the audience segment (if it's missing, offer to create it from the klaviyo_segment given, and do it once they say OK), create the template and a draft campaign, and show them. Never schedule or send without their go-ahead.
4. log_send, so the queue stays clean and the history builds.
5. Results: when the marketer asks how sends did, send_history has each one's Klaviyo campaign id. Read their numbers with the Klaviyo connector (${KLAVIYO_TOOLS.report}): recipients, clicks, orders and revenue. They're Klaviyo's numbers, by the brand's own attribution settings. Every Walkoff campaign's name starts with "Walkoff ·", so the report can also find them by name.

Copy rules: most brands aren't licensed to use team marks. For them, campaign copy never names the team, league, players, stadium or event. It nods with the city (pro teams only) and the colors, through the brand's own products. Moment headlines name teams for the marketer's eyes only. If you rewrite the copy, keep the rules that build_campaign returns.

Athletes: local_athletes shows the marketer which athletes are from towns near their customers. Those names are for the marketer only. Campaign copy never names or describes an athlete (no name, number, position, school or photo) unless the brand has the athlete's written OK on file.`;

/** Hometown moments, for everyone while they're on (lib/hometown/flag.ts). */
export const HOMETOWN_INSTRUCTIONS = `Hometown moments: when an athlete from a town near the brand's customers wins a title, a tournament or a race, or wins a playoff game at the very end, the town gets its own moment. trigger_queue lists them with the rest, with about how many of the brand's customers live there. build_campaign makes the town's campaign: one circle around the town, and copy that celebrates the town. It never names or describes the athlete, and never names the team, league or event, unless the brand has the athlete's written OK on file. Keep that rule if you rewrite the copy.`;

/** What every connection starts with: the instructions, and where the
 *  marketer's help is. */
export const memberInstructions = (origin: string, hometown = hometownLive()) =>
  `${INSTRUCTIONS}${hometown ? `\n\n${HOMETOWN_INSTRUCTIONS}` : ""}\n\nWhen the marketer asks how something works or hits a problem, Walkoff's help center has the answer, ready to link: ${helpUrl(origin, "help")}. Connecting: ${helpUrl(origin, "connect")}. Setting up from Shopify: ${helpUrl(origin, "shopify")}. Uploading files instead: ${helpUrl(origin, "uploads")}. Connecting Klaviyo, and saving a team's segment: ${helpUrl(origin, "klaviyo")}. Tracking and results: ${helpUrl(origin, "klaviyo", "tracking")}. Messages and fixes: ${helpUrl(origin, "troubleshooting")}.`;

/** Added for Walkoff operators, who also set brands up. */
export const OPERATOR_INSTRUCTIONS = `This person is a Walkoff operator, so they can also set brands up. To onboard a brand: create_brand with its name, store and whether it's licensed to name its teams (most aren't), then invite_member for each marketer. Its welcome email tells them how to connect Walkoff and Shopify in Claude and set the brand up there, with the brand's upload link for stores not on Shopify. Once a brand's store is set, you can run import_catalog for it yourself. onboarding_status shows where each brand is and the next step. update_brand, list_members and remove_member handle changes; the tools that change a brand need its exact name or id. Upload links are secret: only invite_member sends them, to the people invited. After removing someone, update_brand with new_upload_link replaces the brand's link, and invite_member sends the new one to the people who should keep it. When Walkoff has an athlete's hometown wrong, set_athlete_home fixes it, with a note on where you learned it. record_athlete_rights records an athlete's written agreement that a brand may name them, with its dates and where the agreement is, or revokes it. create_moment records a win Walkoff doesn't follow itself (a medal, a marathon) and makes the towns' hometown moments right away. retract_moment takes a wrong moment back out of every queue. When an athlete, or someone for them, asks Walkoff to stop using them, exclude_athlete does it, with a note on who asked: then retract the moments it lists.`;

export function createWalkoffServer(ctx: ToolContext): McpServer {
  const member = memberInstructions(ctx.origin, hometownOn(ctx.principal));
  const instructions = isOperator(ctx.principal) ? `${member}\n\n${OPERATOR_INSTRUCTIONS}` : member;
  const server = new McpServer(SERVER_INFO, { instructions });
  registerTools(server, ctx);
  server.registerPrompt(
    "set_up_brand",
    {
      title: "Set up from Shopify",
      description: "Set a brand up from its Shopify store: its products, its customer counts and its fan map, with no files.",
      argsSchema: { brand: z.string().optional().describe("Brand name, when you have more than one.") },
    },
    ({ brand }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Set up Walkoff${brand ? ` for ${brand}` : ""} from our Shopify store. First, import_catalog. Then run these two queries with my Shopify connector's ${SHOPIFY_TOOLS.analytics}, exactly as written:
1. ${SHOPIFYQL.postalCodes}
2. ${SHOPIFYQL.regions}
Pass the first query's rows as postal_codes and the second's as regions to import_customer_counts, one row per line, every row in one call. Counts only: don't read or pass on any customer's name, email or address, and don't use the customer or order tools. Then show me our fan map with get_affinity_map, and tell me what Walkoff kept.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "moment_campaign",
    {
      title: "Campaign for the moment",
      description: "Find the best moment to act on now and turn it into a draft campaign in Klaviyo.",
      argsSchema: { brand: z.string().optional().describe("Brand name, when you have more than one.") },
    },
    ({ brand }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Using Walkoff${brand ? ` for ${brand}` : ""}: check trigger_queue for the best moment to act on right now. If there is one, build_campaign for it and show me the subject lines, the email and the audience. When I say go, use my Klaviyo connector to create the template and a draft campaign for the Walkoff segment (if the segment doesn't exist yet, ask me before creating it), then log it with log_send. Follow Walkoff's copy rules exactly.`,
          },
        },
      ],
    }),
  );
  return server;
}
