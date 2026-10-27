import Link from "next/link";
import { Ask, Callout } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { GuideCards } from "@/components/help/reference";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { HELP_TOOLS } from "@/lib/help/tools";

export const metadata = helpMetadata("help");

const P = "help";

const STARTERS = [
  HELP_TOOLS.import_catalog.asks[0],
  HELP_TOOLS.trigger_queue.asks[0],
  HELP_TOOLS.get_affinity_map.asks[0],
  HELP_TOOLS.build_campaign.asks[1],
  HELP_TOOLS.upcoming_games.asks[0],
  HELP_TOOLS.create_trigger.asks[0],
  HELP_TOOLS.send_history.asks[0],
];

export default function HelpHome() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="start">
        <p>
          Walkoff watches every game in its leagues and spots the big moments: walk-offs,
          comebacks, rivalry wins and more. From your own customer counts, it
          knows which fan territories your customers lean toward, and which of your products
          are in each team&apos;s colors. Claude sets it up from your Shopify store, with no
          files.
        </p>
        <p>
          You use it in Claude. Ask what to send, and Claude builds a ready-to-draft Klaviyo
          campaign for the moment: subject lines, the email, the audience and the send time.
          Nothing goes out until you say so.
        </p>
        <Callout title="New here?">
          <p>
            Start with <Link href={helpPath("onboarding")}>Getting started</Link>: five steps
            from your invite to your first campaign.
          </p>
        </Callout>
      </HelpSection>

      <HelpSection page={P} id="guides">
        <GuideCards />
      </HelpSection>

      <HelpSection page={P} id="ask">
        <p>Ask the way you&apos;d ask a colleague. A few to start with:</p>
        {STARTERS.map((a) => (
          <Ask key={a}>{a}</Ask>
        ))}
        <p>
          <Link href={helpPath("tools", "asks")}>More things to ask</Link>
        </p>
      </HelpSection>

      <HelpSection page={P} id="contact">
        <ul>
          <li>
            <Link href={helpPath("troubleshooting")}>Troubleshooting</Link> covers the messages
            you might see, and what to do about each.
          </li>
          <li>
            <Link href="/status">Status</Link> shows whether the engine and every league are
            running.
          </li>
          <li>
            Email <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>, or reply to your
            welcome email.
          </li>
        </ul>
      </HelpSection>
    </HelpPage>
  );
}
