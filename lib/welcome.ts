// The email someone gets when they're invited to use Walkoff for a brand:
// who invited them, how to connect Walkoff and Klaviyo in Claude, setting
// the brand up there (the catalog), a first thing to ask, and their fan map
// from a Klaviyo export on the brand's private upload page. Shopify in
// Claude is optional. Sent with Resend, like the sign-in codes
// (lib/mcp/oauth/email.ts).
import { Resend } from "resend";
import { CONNECTOR_STEPS, CONNECTORS_PAGE, ORG_CONNECTOR_STEPS } from "./connect";

export interface Welcome {
  to: string;
  brand: string;
  /** Who invited them. Replies go to them. */
  invitedBy: string | null;
  /** The brand's private upload link. */
  uploadUrl: string;
  /** The MCP server: https://www.walkoff.io/mcp */
  connectorUrl: string;
  /** The setup guide: https://www.walkoff.io/onboarding */
  guideUrl: string;
  /** They've signed in to Walkoff for another brand, and a sign-in reaches
   *  only the brands picked when it was made. */
  reconnect?: boolean;
}

export function welcomeEmail(w: Welcome): { subject: string; text: string } {
  const connect = [
    `In Claude, go to ${CONNECTOR_STEPS}, and enter this address:`,
    w.connectorUrl,
    "",
    `Then sign in with this email address (${w.to}). Walkoff emails you a 6-digit code.`,
    "",
    `On a Team or Enterprise plan, an owner adds the connector first, under ${ORG_CONNECTOR_STEPS}.`,
    ...(w.reconnect
      ? ["", `Already connected Walkoff for another brand? Disconnect it in Claude's connector settings and connect again, so you can pick ${w.brand} too.`]
      : []),
  ];
  const text = [
    w.invitedBy ? `${w.invitedBy} invited you to use Walkoff for ${w.brand}.` : `You're invited to use Walkoff for ${w.brand}.`,
    "",
    "Walkoff watches every game and turns big moments into ready-made Klaviyo campaigns for your fans: products in the team's colors, the audience and the send time. You use it in Claude, and nothing goes out without your go-ahead.",
    "",
    "1. Connect Walkoff in Claude",
    "",
    ...connect,
    "",
    "2. Connect Klaviyo in Claude",
    "",
    `It's in Claude's connectors, under ${CONNECTORS_PAGE}. Claude drafts your campaigns in Klaviyo with it. Connecting Shopify in Claude is optional.`,
    "",
    `3. Set up ${w.brand} in Claude`,
    "",
    `Ask Claude: "Set up Walkoff for ${w.brand}."`,
    "",
    "Walkoff reads your products from your store. That's all it needs to build your first campaign.",
    "",
    `Then try: "What should we send this week?"`,
    "",
    "4. Add your fan map",
    "",
    "Your fan map shows which teams your customers lean toward, so Walkoff can point you to the moments that matter most. It's optional. In Klaviyo, export the list or segment you send campaigns to as a CSV, with Email, Zip Code and Country. Then drop it in step 1 of your private upload page:",
    w.uploadUrl,
    "",
    "Your browser keeps only counts by postal area. No names, emails or street addresses reach Walkoff.",
    "",
    `This link is private to ${w.brand}. Anyone with it can upload for you, so please don't share it.`,
    "",
    "Not on Shopify? Drop a product export in step 2 of the same page.",
    "",
    "The setup guide walks through each step:",
    w.guideUrl,
    "",
    w.invitedBy ? "Questions? Reply to this email." : "Questions? Email hello@walkoff.io.",
    "",
    "Walkoff · walkoff.io",
  ].join("\n");
  return { subject: `You're invited to Walkoff for ${w.brand}`, text };
}

/** Emails the welcome with Resend. Without RESEND_API_KEY outside
 *  production, prints it to the server log instead ("dev"). */
export async function sendWelcome(w: Welcome): Promise<"sent" | "dev"> {
  const { subject, text } = welcomeEmail(w);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.log(`[walkoff] welcome email for ${w.to}\nSubject: ${subject}\n\n${text}`);
    return "dev";
  }
  const { error } = await new Resend(key).emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Walkoff <onboarding@resend.dev>",
    to: w.to,
    ...(w.invitedBy ? { replyTo: w.invitedBy } : {}),
    subject,
    text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return "sent";
}
