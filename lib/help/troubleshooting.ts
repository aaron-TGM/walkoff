// Messages people see, word for word, with what to do about each.
// help.test.ts checks every one is still in its source file, so a reworded
// message can't leave the help page quoting something nobody sees.
import { TTL } from "../mcp/oauth/config";

export interface Trouble {
  id: string;
  /** What the person sees. "…" stands for a name or number. */
  says: string;
  /** The part of says that's in the source, when it has a "…". */
  check?: string;
  source: string;
  fix: string;
}

const HANDLERS = "lib/mcp/oauth/handlers.ts";
const PAGES = "lib/mcp/oauth/pages.ts";
const UPLOAD = "components/upload/UploadClient.tsx";
const TOOLS = "lib/mcp/tools.ts";
const DATA = "lib/mcp/data.ts";
const CAMPAIGN = "lib/mcp/campaign.ts";

export const TROUBLE: Record<"sign-in" | "uploads" | "in-claude", Trouble[]> = {
  "sign-in": [
    {
      id: "no-code",
      says: "If … has Walkoff access, we've sent it a 6-digit code.",
      check: "has Walkoff access, we've sent it a 6-digit code.",
      source: PAGES,
      fix: "The page says this for every address, so it can't be used to find out who has access. If no code arrives in a few minutes, check spam, then check you used the exact address you were invited with. Still nothing? Ask the person who invited you to invite that address.",
    },
    {
      id: "wrong-code",
      says: "That code didn't match. … tries left.",
      check: "That code didn't match.",
      source: HANDLERS,
      fix: "Use the newest code: asking again sends a new one, and the old one stops working.",
    },
    {
      id: "too-many-wrong",
      says: "Too many wrong codes. Start again from Claude.",
      source: HANDLERS,
      fix: "Close the window and connect again from Claude. You'll get a new code.",
    },
    {
      id: "too-many-codes",
      says: "Too many codes for one sign-in. Start again from Claude.",
      source: HANDLERS,
      fix: "Close the window and connect again from Claude.",
    },
    {
      id: "codes-this-hour",
      says: "We've sent that address a lot of codes this hour. Try again later.",
      source: HANDLERS,
      fix: "Wait an hour, then connect again.",
    },
    {
      id: "expired",
      says: "This sign-in has expired, or it was opened in another browser.",
      source: HANDLERS,
      fix: `A sign-in lasts ${TTL.request / 60} minutes and works in the browser that started it. Connect again from Claude, and finish in the window it opens.`,
    },
    {
      id: "unknown-app",
      says: "Walkoff doesn't know this app. Remove the connector and add it again.",
      source: HANDLERS,
      fix: "Remove Walkoff from Claude's connectors, add it again with the same address, and sign in.",
    },
    {
      id: "network",
      says: "Too many sign-ins from your network in the last hour. Try again later.",
      source: HANDLERS,
      fix: "Lots of people on one office network can hit this. Wait an hour, or connect from another network.",
    },
    {
      id: "send-failed",
      says: "We couldn't send the email just now. Try again in a minute.",
      source: HANDLERS,
      fix: "Wait a minute and ask for the code again.",
    },
  ],
  uploads: [
    {
      id: "what-file",
      says: "We couldn't tell what this file is. The export guides below show the files we read.",
      source: UPLOAD,
      fix: "Export the file again following a guide on the upload page, and upload it as it comes out. Renamed or removed columns are the usual cause.",
    },
    {
      id: "wrong-step",
      says: "That's a … Drop it in step 2.",
      check: "Drop it in step 2.",
      source: UPLOAD,
      fix: "Products go in step 2 and customers or orders in step 1. The message names the step.",
    },
    {
      id: "no-postal",
      says: "No rows had a US, Canadian or UK postal code we could read.",
      source: UPLOAD,
      fix: "Walkoff maps customers in the US, Canada and the UK. Check the export includes the zip or postal code column. For Klaviyo, include Zip Code and Country.",
    },
    {
      id: "no-titles",
      says: "No products with a title in this file.",
      source: UPLOAD,
      fix: "Use the product export, not the inventory or price export.",
    },
    {
      id: "not-csv",
      says: "We couldn't read that file. Is it a CSV?",
      source: UPLOAD,
      fix: "Export as CSV. If it's a spreadsheet, save it as CSV first.",
    },
    {
      id: "bad-link",
      says: "This upload link isn't valid.",
      source: "app/api/upload/[token]/customers/route.ts",
      fix: "The link was replaced or mistyped. Use the newest welcome email, or ask the person who invited you to send it again.",
    },
  ],
  "in-claude": [
    {
      id: "no-brands",
      says: "No brands are set up for you yet. Ask your Walkoff contact to invite you.",
      source: DATA,
      fix: "Your access to the brands you picked was removed, or they were never set up for this address. Ask the person who invited you.",
    },
    {
      id: "no-brand-match",
      says: 'No brand matches "…". You have …',
      check: "No brand matches",
      source: DATA,
      fix: "Your sign-in doesn't include that brand. If you were invited to it after you connected, disconnect Walkoff in Claude and connect again, then pick it.",
    },
    {
      id: "which-brand",
      says: "Which brand? You have …",
      check: "Which brand? You have",
      source: DATA,
      fix: "You can use more than one brand. Name the one you mean.",
    },
    {
      id: "no-map",
      says: "… hasn't uploaded customers yet, so there's no map.",
      check: "hasn't uploaded customers yet, so there's no map.",
      source: TOOLS,
      fix: "Upload customers or orders on your upload page. The link is in your welcome email.",
    },
    {
      id: "no-standouts",
      says: "… has no standout fan territories yet (it needs a customer upload). Name a team instead.",
      check: "has no standout fan territories yet (it needs a customer upload). Name a team instead.",
      source: TOOLS,
      fix: "Upload customers or orders, or name a team in your ask. If your map has no standouts, your customers are spread like the population, so name the teams you care about.",
    },
    {
      id: "no-catalog",
      says: "No catalog yet: upload a Shopify product export.",
      source: TOOLS,
      fix: "Upload your product export in step 2 of your upload page.",
    },
    {
      id: "no-colors",
      says: "Nothing in the catalog is close to the team's colors.",
      source: TOOLS,
      fix: "Name the products you want to feature. build_campaign takes them in products.",
    },
    {
      id: "no-store",
      says: "No store address on file, so the email has no links.",
      source: CAMPAIGN,
      fix: "Give Claude your store's address for this campaign, and ask your Walkoff contact to add it for next time.",
    },
    {
      id: "few-customers",
      says: "Only about … of the brand's uploaded customers live in this audience.",
      check: "of the brand's uploaded customers live in this audience.",
      source: CAMPAIGN,
      fix: 'Ask for reach "wide" to include shared markets, or skip the moment.',
    },
    {
      id: "still-live",
      says: "This moment is still live.",
      source: CAMPAIGN,
      fix: "Wait for the result. A win brings its own moment, and Walkoff spots it within a minute or so.",
    },
    {
      id: "busy",
      says: "Walkoff hit an error reading its data. Try again in a minute.",
      source: TOOLS,
      fix: "Ask again in a minute. If it keeps happening, check the status page.",
    },
  ],
};
