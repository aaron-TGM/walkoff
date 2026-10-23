// The Walkoff MCP server, built fresh for each request (the /mcp route is
// stateless) for the person the access token belongs to.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { helpUrl } from "../help/pages";
import { KLAVIYO_TOOLS } from "./campaign";
import { isOperator } from "./data";
import { registerTools, type ToolContext } from "./tools";

export const SERVER_INFO = { name: "walkoff", title: "Walkoff", version: "1.0.0" };

export const INSTRUCTIONS = `Walkoff turns sports moments into ready-made campaigns for brands whose customers are fans. It knows each brand's fan territories (from its own customer data), its catalog by color, and live moments from every game in its leagues: walk-off wins, buzzer beaters, comebacks, rivalry wins, heartbreakers, series wins and titles, rivalry and big-game previews.

The usual flow:
1. list_brands, then trigger_queue for the moments to act on now.
2. build_campaign with a moment_id: subject lines, preview text, a finished email, products, the audience and when to send.
3. With the marketer's Klaviyo connector: find the audience segment (if it's missing, offer to create it from the klaviyo_segment given, and do it once they say OK), create the template and a draft campaign, and show them. Never schedule or send without their go-ahead.
4. log_send, so the queue stays clean and the history builds.
5. Results: when the marketer asks how sends did, send_history has each one's Klaviyo campaign id. Read their numbers with the Klaviyo connector (${KLAVIYO_TOOLS.report}): recipients, clicks, orders and revenue. They're Klaviyo's numbers, by the brand's own attribution settings. Every Walkoff campaign's name starts with "Walkoff ·", so the report can also find them by name.

Copy rules: most brands aren't licensed to use team marks. For them, campaign copy never names the team, league, players, stadium or event. It nods with the city (pro teams only) and the colors, through the brand's own products. Moment headlines name teams for the marketer's eyes only. If you rewrite the copy, keep the rules that build_campaign returns.`;

/** What every connection starts with: the instructions, and where the
 *  marketer's help is. */
export const memberInstructions = (origin: string) =>
  `${INSTRUCTIONS}\n\nWhen the marketer asks how something works or hits a problem, Walkoff's help center has the answer, ready to link: ${helpUrl(origin, "help")}. Connecting: ${helpUrl(origin, "connect")}. Connecting Klaviyo, and saving a team's segment: ${helpUrl(origin, "klaviyo")}. Tracking and results: ${helpUrl(origin, "klaviyo", "tracking")}. Messages and fixes: ${helpUrl(origin, "troubleshooting")}.`;

/** Added for Walkoff operators, who also set brands up. */
export const OPERATOR_INSTRUCTIONS = `This person is a Walkoff operator, so they can also set brands up. To onboard a brand: create_brand with its name, store and whether it's licensed to name its teams (most aren't), then invite_member for each marketer, which emails them the brand's upload link and how to connect Walkoff in Claude. onboarding_status shows where each brand is and the next step. update_brand, list_members and remove_member handle changes; the tools that change a brand need its exact name or id. Upload links are secret: only invite_member sends them, to the people invited. After removing someone, update_brand with new_upload_link replaces the brand's link, and invite_member sends the new one to the people who should keep it.`;

export function createWalkoffServer(ctx: ToolContext): McpServer {
  const member = memberInstructions(ctx.origin);
  const instructions = isOperator(ctx.principal) ? `${member}\n\n${OPERATOR_INSTRUCTIONS}` : member;
  const server = new McpServer(SERVER_INFO, { instructions });
  registerTools(server, ctx);
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
