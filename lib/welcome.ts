// The email someone gets when they're invited to use Walkoff for a brand:
// who invited them, their upload page, how to connect Walkoff in Claude and a
// first thing to ask. Sent with Resend, like the sign-in codes
// (lib/mcp/oauth/email.ts).
import { Resend } from "resend";

export interface Welcome {
  to: string;
  brand: string;
  /** Who invited them. Replies go to them. */
  invitedBy: string | null;
  /** The brand's private upload link. */
  uploadUrl: string;
  /** The MCP server: https://www.walkoff.io/mcp */
  connectorUrl: string;
  /** They've signed in to Walkoff for another brand, and a sign-in reaches
   *  only the brands picked when it was made. */
  reconnect?: boolean;
}

export function welcomeEmail(w: Welcome): { subject: string; text: string } {
  const connect = [
    "In Claude, go to Customize → Connectors → Add custom connector, and enter this address:",
    w.connectorUrl,
    "",
    `Then sign in with this email address (${w.to}). Walkoff emails you a 6-digit code.`,
    "",
    "On a Team or Enterprise plan, an owner adds the connector first, under Organization settings → Connectors.",
    ...(w.reconnect
      ? ["", `Already connected Walkoff for another brand? Disconnect it in Claude's connector settings and connect again, so you can pick ${w.brand} too.`]
      : []),
  ];
  const text = [
    w.invitedBy ? `${w.invitedBy} invited you to use Walkoff for ${w.brand}.` : `You're invited to use Walkoff for ${w.brand}.`,
    "",
    "Walkoff watches every game and turns big moments into ready-made Klaviyo campaigns for your fans: products in the team's colors, the audience and the send time. You use it in Claude, and nothing goes out without your go-ahead.",
    "",
    "1. Upload your exports",
    "",
    "Your upload page:",
    w.uploadUrl,
    "",
    "In step 1, add a Shopify orders export (best) or a customers export. In step 2, add your products export. The page shows how to export each one. Your browser keeps only counts by postal area. Names, emails and street addresses never leave your computer.",
    "",
    `This link is private to ${w.brand}. Anyone with it can upload for you, so please don't share it.`,
    "",
    "2. Connect Walkoff in Claude",
    "",
    ...connect,
    "",
    "Claude drafts the campaigns with your Klaviyo connector, so connect Klaviyo too if you haven't.",
    "",
    "3. Ask Claude",
    "",
    `Once your files are in, try: "What should we send this week?"`,
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
