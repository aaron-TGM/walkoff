import Link from "next/link";
import { Ask, CopyLine, HelpFaq, Step, Steps } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { CONNECTOR_STEPS, CONNECTOR_URL, ORG_CONNECTOR_STEPS, STEPS_CHECKED } from "@/lib/connect";
import { TRACKING } from "@/lib/help/klaviyo";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { DEFAULT_RULE, WINDOW_HOURS } from "@/lib/mcp/queue";
import { PRICING } from "@/lib/pricing";

export const metadata = helpMetadata("onboarding");

const P = "onboarding";

export default function OnboardingPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="what-you-need">
        <ul>
          <li>
            <strong>An invite.</strong> During early access, Walkoff sets up every brand and
            invites the people who&apos;ll use it. Not invited yet?{" "}
            <Link href="/#form" data-cta="onboarding">Ask for early access</Link>.
          </li>
          <li>
            <strong>Claude, with the Shopify and Klaviyo connectors.</strong> Claude sets your
            brand up from your Shopify store, with no files. Walkoff finds the moment and builds
            the campaign, and your Klaviyo connector drafts it in your account.{" "}
            <Link href={helpPath("shopify")}>Shopify in Claude</Link> &middot;{" "}
            <Link href={helpPath("klaviyo")}>Klaviyo in Claude</Link>
          </li>
          <li>
            <strong>Not on Shopify?</strong> Your exports, on a private upload page.{" "}
            <Link href={helpPath("uploads")}>Uploading files</Link>
          </li>
        </ul>
      </HelpSection>

      <HelpSection page={P} id="steps">
        <Steps>
          <Step who="walkoff" title="You're invited">
            <p>
              We set up your brand with your store&apos;s address and whether you&apos;re
              licensed to use your teams&apos; names. Most brands aren&apos;t, and that&apos;s
              fine.
            </p>
            <p>
              Then we invite each person who&apos;ll use Walkoff. Each gets an email with who
              invited them, how to connect Walkoff in Claude and set your brand up there, and a
              first thing to ask. It also has your private upload link, for stores not on
              Shopify.
            </p>
            <p>
              The upload link is private to your brand, so keep it within your team.{" "}
              <Link href={helpPath("data-and-safety", "upload-link")}>About the link</Link>
            </p>
          </Step>

          <Step who="you" title="Connect Claude, Shopify and Klaviyo">
            <p>In Claude, go to {CONNECTOR_STEPS}, and enter this address:</p>
            <CopyLine>{CONNECTOR_URL}</CopyLine>
            <p>
              Sign in with the email you were invited with. Walkoff emails you a 6-digit code.
              Then pick the brands Claude can use.
            </p>
            <p>
              On a Team or Enterprise plan, an owner adds the connector first, under{" "}
              {ORG_CONNECTOR_STEPS}.
            </p>
            <p>
              Connect Shopify too, with an account that can see your store&apos;s reports. Claude
              sets your brand up with it.{" "}
              <Link href={helpPath("shopify", "connect")}>Connecting Shopify</Link>
            </p>
            <p>
              And Klaviyo, if you haven&apos;t. Claude drafts each campaign with your Klaviyo
              connector, in your account.{" "}
              <Link href={helpPath("klaviyo", "connect")}>Connecting Klaviyo</Link>
            </p>
            <p>
              In Klaviyo, check UTM tracking is on, under {TRACKING.utmSettings}. Then your sends
              show up in Shopify, Google Analytics and Triple Whale.{" "}
              <Link href={helpPath("klaviyo", "tracking")}>Tracking your sends</Link>
            </p>
            <p>
              <Link href={helpPath("connect")}>Connecting, step by step</Link> &middot; checked
              against Claude in {STEPS_CHECKED}
            </p>
          </Step>

          <Step who="you" title="Set up your brand in Claude">
            <p>Ask Claude:</p>
            <Ask>Set up Walkoff from our Shopify store.</Ask>
            <p>
              Walkoff reads your products from your store. Claude reads customer counts by postal
              code from Shopify&apos;s analytics, and Walkoff keeps only each code&apos;s area and
              the count. No names, emails or street addresses reach Walkoff. Your fan map is ready
              in a few minutes.
            </p>
            <p>
              <Link href={helpPath("shopify", "set-up")}>Setting up, in detail</Link> &middot; Not
              on Shopify? <Link href={helpPath("uploads", "export")}>Upload your exports instead</Link>
            </p>
          </Step>

          <Step who="walkoff" title="We tag your catalog">
            <p>
              Your products get keyword tags as they come in, and every colorway is read from your
              variants&apos; color option. Common color names like &ldquo;Azure Heather&rdquo; get
              their colors right away.
            </p>
            <p>
              Then Claude reads every product, usually within a few minutes: the teams it&apos;s
              made for, its colors, uses and seasons, and what names like &ldquo;Dune&rdquo; look
              like. You don&apos;t do anything here, and your map and picks work before it&apos;s
              done. Later imports keep this work, and new or changed products get the same pass.
            </p>
          </Step>

          <Step who="you" title="Your first campaign">
            <p>Once your brand is set up, ask Claude:</p>
            <Ask>What should we send this week?</Ask>
            <p>
              Claude checks your queue, builds a campaign for the best moment, and shows you the
              subject lines, the email, the audience and the send time.
            </p>
            <p>
              The first time you use a team, Claude offers to create its Klaviyo segment. Say OK,
              and every later moment for that team reuses it.{" "}
              <Link href={helpPath("audiences", "save")}>Why once</Link>
            </p>
            <p>
              When it looks right, tell Claude to go, and it drafts the campaign in Klaviyo.
              Schedule it there, or have Claude schedule it if your Klaviyo connector can. Then
              ask Claude to log it, so it leaves your queue. A few days later, ask how it did.
            </p>
            <p>
              <Link href={helpPath("campaigns")}>Campaigns, in detail</Link>
            </p>
          </Step>
        </Steps>
      </HelpSection>

      <HelpSection page={P} id="what-to-expect">
        <ul>
          <li>
            <strong>Your fan map</strong> appears a few minutes after you ask Claude to set your
            brand up, or right after an upload.
          </li>
          <li>
            <strong>Claude&apos;s product tags</strong> come a few minutes after your catalog
            comes in, longer for a catalog in the thousands. Your picks get sharper when they
            land.
          </li>
          <li>
            <strong>Moments</strong> from games show up within about a minute of the final
            whistle. Golf, tennis and racing results take a few minutes, and surfing usually a
            few hours.
          </li>
          <li>
            <strong>Your queue</strong> starts with Walkoff&apos;s default rule:{" "}
            {DEFAULT_RULE.name.toLowerCase()}. Make your own triggers whenever you like.{" "}
            <Link href={helpPath("moments", "triggers")}>Triggers</Link>
          </li>
          <li>
            <strong>Timing matters.</strong> A result is worth acting on for about{" "}
            {WINDOW_HOURS.result} hours. Send it the same day if you can.
          </li>
          <li>
            <strong>Nothing sends without you.</strong> Claude drafts, and you decide.
          </li>
        </ul>
      </HelpSection>

      <HelpSection page={P} id="questions">
        <HelpFaq
          items={[
            {
              id: "colleagues",
              q: "Can my colleagues use it too?",
              a: (
                <p>
                  Yes. Ask your Walkoff contact to invite them. Each person gets their own welcome
                  email and signs in with their own address.
                </p>
              ),
            },
            {
              id: "license",
              q: "Do we need a sports license?",
              a: (
                <p>
                  No. Without one, campaigns never name a team, league, player or event. They nod
                  with the colors, and the city for pro teams, through your own products.{" "}
                  <Link href={helpPath("campaigns", "copy-rules")}>The copy rules</Link>
                </p>
              ),
            },
            {
              id: "who-sends",
              q: "Does Walkoff email our customers?",
              a: (
                <p>
                  No. Klaviyo does, from your account, when you say so. Your unsubscribes,
                  suppressions and Smart Sending stay as they are.
                </p>
              ),
            },
            {
              id: "tracking",
              q: "Do we need to add tracking?",
              a: (
                <p>
                  No. Walkoff&apos;s emails are ordinary Klaviyo campaigns, so Klaviyo, Shopify,
                  Google Analytics, Triple Whale and your Meta pixel see them like any other. Just
                  check UTM tracking is on in Klaviyo.{" "}
                  <Link href={helpPath("klaviyo", "tracking")}>Tracking your sends</Link>
                </p>
              ),
            },
            {
              id: "shopify-data",
              q: "What does Walkoff see from Shopify?",
              a: (
                <p>
                  Your products, from your store&apos;s public product feed, and customer counts
                  by postal code from Shopify&apos;s analytics. Walkoff cuts each code to its area
                  and keeps only the area and the count. Never names, emails or addresses.{" "}
                  <Link href={helpPath("shopify", "privacy")}>What Walkoff sees</Link>
                </p>
              ),
            },
            {
              id: "platforms",
              q: "We don't use Shopify. Can we still use Walkoff?",
              a: (
                <p>
                  Yes, with the private upload page in your welcome email. A Klaviyo profile export
                  works for customers, or a spreadsheet with postal_code, country and customers
                  columns. For products, a spreadsheet with title, product type and tags.
                  Campaigns are built for Klaviyo.
                </p>
              ),
            },
            {
              id: "cost",
              q: "What does it cost?",
              a: (
                <p>
                  ${PRICING.firstLeague} a month per brand, including one league. Each extra league
                  is ${PRICING.extraLeague}, and every league together is ${PRICING.allLeagues}.{" "}
                  {PRICING.trialDays} days free, no credit card.
                </p>
              ),
            },
            {
              id: "demo",
              q: "Can I try it first?",
              a: (
                <p>
                  Yes. <Link href="/upload/demo">The demo</Link> shows a sample brand&apos;s map,
                  with no file needed. It can also read your own file in your browser. Nothing is
                  uploaded.
                </p>
              ),
            },
          ]}
        />
      </HelpSection>
    </HelpPage>
  );
}
