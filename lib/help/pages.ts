// The help center's pages, in sidebar order: the sidebar, the sitemap, page
// metadata and every link into help come from here. helpPath only takes
// slugs and sections that exist, so a link to a missing page fails
// type-checking, and help.test.ts checks each section is on its page.
import type { Metadata } from "next";

export const HELP_PAGES = [
  {
    slug: "onboarding",
    path: "/onboarding",
    nav: "Getting started",
    title: "Getting started",
    description: "How a brand gets set up on Walkoff, step by step, and who does each part.",
    sections: [
      { id: "what-you-need", title: "What you need" },
      { id: "steps", title: "Five steps to your first campaign" },
      { id: "what-to-expect", title: "What to expect" },
      { id: "questions", title: "Questions" },
    ],
  },
  {
    slug: "help",
    path: "/help",
    nav: "Help center",
    title: "Help center",
    description: "How to use Walkoff in Claude: your fan map, moments, campaigns, audiences and the tools behind them.",
    sections: [
      { id: "start", title: "Start here" },
      { id: "guides", title: "Guides" },
      { id: "ask", title: "Things to ask Claude" },
      { id: "contact", title: "Still stuck?" },
    ],
  },
  {
    slug: "connect",
    path: "/help/connect",
    nav: "Connect Claude",
    title: "Connect Walkoff in Claude",
    description: "Add Walkoff as a connector in Claude, sign in with your work email and pick your brands.",
    sections: [
      { id: "claude", title: "In Claude" },
      { id: "teams", title: "Team and Enterprise plans" },
      { id: "claude-code", title: "In Claude Code" },
      { id: "sign-in", title: "Signing in" },
      { id: "brands", title: "Picking brands" },
      { id: "another-brand", title: "Invited to another brand later" },
      { id: "disconnect", title: "Disconnecting" },
    ],
  },
  {
    slug: "klaviyo",
    path: "/help/klaviyo",
    nav: "Klaviyo in Claude",
    title: "Klaviyo in Claude",
    description: "Connect Klaviyo in Claude, see what Claude does in your account, and save each team's segment once.",
    sections: [
      { id: "why", title: "What Claude does in Klaviyo" },
      { id: "connect", title: "Connecting Klaviyo" },
      { id: "accounts", title: "More than one Klaviyo account" },
      { id: "settings", title: "Settings that matter" },
      { id: "segments", title: "Saving each team's segment" },
      { id: "trouble", title: "When something's off" },
    ],
  },
  {
    slug: "uploads",
    path: "/help/uploads",
    nav: "Your uploads",
    title: "Your uploads",
    description: "What to export, what leaves your browser, and how to update your data.",
    sections: [
      { id: "what-leaves", title: "What leaves your browser" },
      { id: "files", title: "Which files" },
      { id: "export", title: "How to export" },
      { id: "colorways", title: "Products and colorways" },
      { id: "updating", title: "Updating your data" },
      { id: "demo", title: "Try the demo" },
    ],
  },
  {
    slug: "fan-map",
    path: "/help/fan-map",
    nav: "Your fan map",
    title: "Your fan map",
    description: "How Walkoff finds the fan territories your customers lean toward, and what to feature in each.",
    sections: [
      { id: "lift", title: "Lift, in plain words" },
      { id: "standouts", title: "Standout territories" },
      { id: "buys", title: "What each territory buys" },
      { id: "picks", title: "Products to feature" },
      { id: "example", title: "An example map" },
    ],
  },
  {
    slug: "moments",
    path: "/help/moments",
    nav: "Moments and triggers",
    title: "Moments and triggers",
    description: "The moments Walkoff watches for, how long each is worth acting on, and how triggers fill your queue.",
    sections: [
      { id: "types", title: "Moment types" },
      { id: "leagues", title: "Leagues" },
      { id: "queue", title: "Your queue" },
      { id: "default-rule", title: "The default rule" },
      { id: "triggers", title: "Your own triggers" },
      { id: "skipping", title: "Skipping a moment" },
    ],
  },
  {
    slug: "campaigns",
    path: "/help/campaigns",
    nav: "Campaigns",
    title: "Campaigns",
    description: "What Walkoff builds for a moment, the copy rules it follows, and how a campaign gets from Claude to your customers.",
    sections: [
      { id: "loop", title: "From moment to send" },
      { id: "sample", title: "A sample campaign" },
      { id: "copy-rules", title: "Copy rules" },
      { id: "timing", title: "Send timing" },
      { id: "your-call", title: "Offers, products and samples" },
      { id: "logging", title: "Logging what you did" },
    ],
  },
  {
    slug: "audiences",
    path: "/help/audiences",
    nav: "Audiences in Klaviyo",
    title: "Audiences in Klaviyo",
    description: "Each team's fans as a Klaviyo segment: save it once per team and reuse it for every moment.",
    sections: [
      { id: "circles", title: "Proximity circles" },
      { id: "example", title: "An example segment" },
      { id: "reach", title: "Core or wide" },
      { id: "uk", title: "UK clubs" },
      { id: "save", title: "Save it once per team" },
    ],
  },
  {
    slug: "tools",
    path: "/help/tools",
    nav: "Tools and asks",
    title: "Tools and asks",
    description: "Every tool Claude can use in Walkoff, what it's for, and what to ask.",
    sections: [
      { id: "sessions", title: "Example sessions" },
      { id: "asks", title: "Things to ask" },
      { id: "reference", title: "Every tool" },
      { id: "prompt", title: "The campaign prompt" },
    ],
  },
  {
    slug: "data-and-safety",
    path: "/help/data-and-safety",
    nav: "Data and safety",
    title: "Data and safety",
    description: "What Walkoff keeps, who can see it, and the rules every campaign follows.",
    sections: [
      { id: "counts", title: "Counts, not customer lists" },
      { id: "walls", title: "Brands are walled off" },
      { id: "upload-link", title: "Your upload link" },
      { id: "sign-in", title: "Sign-in and tokens" },
      { id: "approval", title: "Approval first" },
      { id: "licenses", title: "Team names and licenses" },
    ],
  },
  {
    slug: "troubleshooting",
    path: "/help/troubleshooting",
    nav: "Troubleshooting",
    title: "Troubleshooting",
    description: "Messages you might see in Claude, at sign-in or on the upload page, and what to do about each.",
    sections: [
      { id: "sign-in", title: "Signing in" },
      { id: "uploads", title: "Uploads" },
      { id: "in-claude", title: "In Claude" },
      { id: "contact", title: "Still stuck?" },
    ],
  },
] as const;

export type HelpPage = (typeof HELP_PAGES)[number];
export type HelpSlug = HelpPage["slug"];
export type HelpSectionId<S extends HelpSlug> = Extract<HelpPage, { slug: S }>["sections"][number]["id"];

export const helpPage = <S extends HelpSlug>(slug: S) => HELP_PAGES.find((p) => p.slug === slug) as Extract<HelpPage, { slug: S }>;

export const helpPath = <S extends HelpSlug>(slug: S, section?: HelpSectionId<S>) => `${helpPage(slug).path}${section ? `#${section}` : ""}`;

/** An absolute link, for emails and for Claude. */
export const helpUrl = <S extends HelpSlug>(origin: string, slug: S, section?: HelpSectionId<S>) =>
  `${origin.replace(/\/+$/, "")}${helpPath(slug, section)}`;

export function helpMetadata(slug: HelpSlug): Metadata {
  const p = helpPage(slug);
  const title = `${p.title} · Walkoff`;
  return {
    title,
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: { title, description: p.description, url: p.path, siteName: "Walkoff", type: "article" },
  };
}
