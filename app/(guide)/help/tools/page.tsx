import Link from "next/link";
import { Ask, ExampleSession } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { ToolReference } from "@/components/help/reference";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { SESSIONS } from "@/lib/help/sessions";
import { HELP_TOOLS, type ToolName } from "@/lib/help/tools";
import { SITE_URL } from "@/lib/connect";
import { memberInstructions } from "@/lib/mcp/server";

export const metadata = helpMetadata("tools");

const P = "tools";

const GROUPS: { title: string; tools: ToolName[] }[] = [
  { title: "Setting up", tools: ["import_catalog", "import_customer_counts"] },
  { title: "Your fans", tools: ["get_affinity_map", "match_products"] },
  { title: "What's happening", tools: ["trigger_queue", "recent_moments", "upcoming_games"] },
  { title: "Campaigns", tools: ["build_campaign", "get_territory", "log_send"] },
  { title: "Triggers and history", tools: ["create_trigger", "list_triggers", "delete_trigger", "send_history"] },
  { title: "Your brands", tools: ["list_brands"] },
];

export default function ToolsPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="sessions">
        <p>
          You don&apos;t need the tool names. Ask in plain words, and Claude picks the tools. A
          week can look like this:
        </p>
        <ExampleSession {...SESSIONS.week} />
        <p>And setting up what you want to hear about:</p>
        <ExampleSession {...SESSIONS.trigger} />
        <p>Setting your brand up from Shopify, the first time:</p>
        <ExampleSession {...SESSIONS.setup} />
      </HelpSection>

      <HelpSection page={P} id="asks">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3>{g.title}</h3>
            {g.tools.flatMap((t) => HELP_TOOLS[t].asks).map((a) => (
              <Ask key={a}>{a}</Ask>
            ))}
          </div>
        ))}
      </HelpSection>

      <HelpSection page={P} id="reference">
        <p>
          Every tool Claude can use in Walkoff. Read-only tools only look things up. The ones
          that save changes touch your catalog, your customer counts, your triggers and your
          send log. None of them sends anything.
        </p>
        <ToolReference />
      </HelpSection>

      <HelpSection page={P} id="prompt">
        <p>
          Walkoff also gives Claude two ready-made prompts. If your Claude app shows connector
          prompts, they&apos;re under Walkoff.
        </p>
        <ul>
          <li>
            <strong>Campaign for the moment</strong> checks your queue for the best moment,
            builds the campaign, and shows you the subject lines, the email and the audience.
            When you say go, it drafts the campaign in Klaviyo and logs it.
          </li>
          <li>
            <strong>Set up from Shopify</strong> imports your catalog from your store and your
            customer counts from Shopify&apos;s analytics, then shows you your fan map.{" "}
            <Link href={helpPath("shopify", "set-up")}>Setting up</Link>
          </li>
        </ul>
        <h3>What Walkoff tells Claude</h3>
        <p>Every connection starts with these instructions:</p>
        <blockquote className="help-quote">{memberInstructions(SITE_URL)}</blockquote>
      </HelpSection>
    </HelpPage>
  );
}
