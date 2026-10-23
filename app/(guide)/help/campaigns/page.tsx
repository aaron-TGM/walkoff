import Link from "next/link";
import { Callout } from "@/components/help/blocks";
import { RuleList, SampleCampaign, TimingTable } from "@/components/help/campaign";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { sampleCopyRules } from "@/lib/help/samples";
import { SEND_HOURS } from "@/lib/mcp/timing";

export const metadata = helpMetadata("campaigns");

const P = "campaigns";

// 21 -> "9 PM", 8 -> "8 AM"
const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

export default function CampaignsPage() {
  const rules = sampleCopyRules();
  const placeRule = rules.college.find((r) => !rules.pro.includes(r));
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="loop">
        <ol>
          <li>
            <strong>Find the moment.</strong> Claude checks your queue.
          </li>
          <li>
            <strong>Build the campaign.</strong> Walkoff returns subject lines, preview text, the
            finished email, your products with links and prices, the audience, when to send, the
            copy rules and the steps to draft it.
          </li>
          <li>
            <strong>Review it.</strong> Claude shows you the email, the audience and the send
            time. Ask for changes in plain words: another subject line, a different product, an
            offer.
          </li>
          <li>
            <strong>Save the segment, once per team.</strong> The first time, Claude gives you the
            steps. <Link href={helpPath("audiences", "save")}>Audiences</Link>
          </li>
          <li>
            <strong>Draft it in Klaviyo.</strong> When you say go, Claude uses your Klaviyo
            connector to create the template and a draft campaign for that segment, with Smart
            Sending on. <Link href={helpPath("klaviyo", "why")}>Klaviyo in Claude</Link>
          </li>
          <li>
            <strong>Send it.</strong> Schedule it in Klaviyo, or have Claude schedule it if your
            connector can. Nothing goes out until you say so.
          </li>
          <li>
            <strong>Log it.</strong> Claude records what you did, so it leaves your queue.
          </li>
        </ol>
      </HelpSection>

      <HelpSection page={P} id="sample">
        <p>
          Ask &ldquo;Show me a sample campaign for a Chargers walk-off.&rdquo; and Walkoff builds
          one before there&apos;s a real moment. This is what it returns for the demo brand, which
          has no team license:
        </p>
        <SampleCampaign />
        <p>
          The copy never names the team. The nod is the colors, through the brand&apos;s own
          products. And because the demo brand&apos;s Chargers fans live around San Diego, not
          Los Angeles, it doesn&apos;t name a city either.
        </p>
      </HelpSection>

      <HelpSection page={P} id="copy-rules">
        <p>
          Most brands aren&apos;t licensed to use team names and marks. For them, every campaign
          follows these rules, and build_campaign returns them with each one:
        </p>
        <RuleList rules={rules.pro} />
        {placeRule ? (
          <p>
            For college teams and clubs, one rule changes: &ldquo;{placeRule}&rdquo;
          </p>
        ) : null}
        <p>Licensed brands may name their teams, within the license:</p>
        <RuleList rules={rules.licensed} />
        <p>
          Moment headlines, like &ldquo;Walk-off win: Chargers 27, Chiefs 24&rdquo;, name teams
          for your eyes only. If you or Claude rewrite the copy, keep the rules.
        </p>
      </HelpSection>

      <HelpSection page={P} id="timing">
        <p>
          Walkoff times each send for where the fans live, between {hour(SEND_HOURS.earliest)} and{" "}
          {hour(SEND_HOURS.latest)} their time.
        </p>
        <ul>
          <li>
            After a result: right away, if it&apos;s a decent hour there. If it ended late, the
            next morning at {hour(SEND_HOURS.earliest)}.
          </li>
          <li>
            Before a game: the morning of game day. On game day itself, right away, or skip it
            if kickoff is close.
          </li>
        </ul>
        <TimingTable />
        <p>Klaviyo&apos;s Smart Sending stays on, so nobody who just got an email from you gets another.</p>
      </HelpSection>

      <HelpSection page={P} id="your-call">
        <ul>
          <li>
            <strong>Offers.</strong> Add one in your ask, like &ldquo;15% off with code BOLT15
            through Monday&rdquo;. It goes in the email as you wrote it.
          </li>
          <li>
            <strong>Products.</strong> Walkoff features up to three from your catalog, in the
            team&apos;s colors. Name your own and they&apos;re featured instead.
          </li>
          <li>
            <strong>Reach.</strong> Core fans by default. Ask for wide to include shared markets.{" "}
            <Link href={helpPath("audiences", "reach")}>Core or wide</Link>
          </li>
          <li>
            <strong>Samples.</strong> Name a team and a kind of moment to see a campaign before
            there&apos;s a real one. Samples are for previewing, not sending.
          </li>
          <li>
            <strong>Your words.</strong> Ask Claude to change anything. The copy rules still
            apply.
          </li>
        </ul>
        <p>
          Watch for warnings. Walkoff flags a sample, a game that&apos;s still live, a loss, a
          moment past its window, a missing store address, and an audience with few of your
          customers in it.
        </p>
      </HelpSection>

      <HelpSection page={P} id="logging">
        <p>Logging keeps your queue clean and builds your history. Claude logs each moment as:</p>
        <ul>
          <li>
            <strong>Drafted:</strong> a Klaviyo draft exists.
          </li>
          <li>
            <strong>Sent:</strong> it&apos;s scheduled or sent.
          </li>
          <li>
            <strong>Skipped:</strong> you passed on it.
          </li>
        </ul>
        <p>
          A logged moment leaves your queue. Ask &ldquo;What did we send last month?&rdquo; to
          see your history, with the moment behind each send.
        </p>
        <Callout title="Coming">
          <p>
            Results: holdout groups that show what each moment added, and sends matched to your
            orders.
          </p>
        </Callout>
      </HelpSection>
    </HelpPage>
  );
}
