import Link from "next/link";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { TTL } from "@/lib/mcp/oauth/config";

export const metadata = helpMetadata("data-and-safety");

const P = "data-and-safety";

export default function DataAndSafetyPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="counts">
        <p>
          Walkoff works from counts, not customer lists. When Claude sets your brand up from
          Shopify, it reads counts by postal code from Shopify&apos;s analytics: a country, a
          postal code or state, and a number of customers. Walkoff cuts each postal code to its
          area as it arrives, keeps the area and the count, and lets go of the rest. It never asks
          for names, emails or addresses, and it refuses rows that hold them.{" "}
          <Link href={helpPath("shopify", "privacy")}>What Walkoff sees from Shopify</Link>
        </p>
        <p>
          Not on Shopify? Your browser turns each export into customers, orders and revenue per
          postal area before anything is sent, and Walkoff refuses anything finer.{" "}
          <Link href={helpPath("uploads", "what-leaves")}>What leaves your browser</Link>
        </p>
        <p>
          So Walkoff never has your customers&apos; names, emails or addresses, and there&apos;s
          no customer list to leak. Klaviyo, which already has your list, does the sending.
        </p>
        <p>
          Your products come from your store&apos;s public product feed, or your product file:
          product details only. Claude reads those details, through Anthropic&apos;s API, to tag
          your catalog. No customer data goes with them.
        </p>
      </HelpSection>

      <HelpSection page={P} id="walls">
        <p>
          Each brand&apos;s data is walled off from every other brand&apos;s. You see only the
          brands you were invited to, and only the ones you picked when you signed in. Every tool
          checks this on every request.
        </p>
      </HelpSection>

      <HelpSection page={P} id="upload-link">
        <p>
          Your upload link is for stores not on Shopify, and it&apos;s private to your brand.
          Anyone with it can upload files for your brand and see your fan map. Walkoff sends it only to the people invited to your brand,
          in their welcome email.
        </p>
        <ul>
          <li>Keep it within your team, and don&apos;t post it anywhere public.</li>
          <li>
            If someone leaves, ask your Walkoff contact to replace it. The old link stops working,
            and everyone who should keep uploading gets the new one.
          </li>
        </ul>
      </HelpSection>

      <HelpSection page={P} id="sign-in">
        <p>
          Walkoff doesn&apos;t use passwords. You sign in with a code emailed to your work
          address, and only invited addresses get one.
        </p>
        <p>
          Walkoff keeps only hashed tokens, never the tokens themselves. Access lasts a day at a
          time and renews by itself. A sign-in you haven&apos;t used in {TTL.refresh / 86_400} days
          ends.
        </p>
        <p>When someone is removed from a brand, it takes effect on their next request.</p>
      </HelpSection>

      <HelpSection page={P} id="approval">
        <p>
          Walkoff never sends anything. It builds the campaign, Claude drafts it in your Klaviyo
          account, and it goes out only when you say so. Walkoff tells Claude never to schedule or
          send without your go-ahead, and to ask before it creates a segment.
        </p>
        <p>
          Your Klaviyo settings stay as they are: unsubscribes, suppressions and Smart Sending all
          apply. Triggers fill your queue. They don&apos;t send.
        </p>
      </HelpSection>

      <HelpSection page={P} id="licenses">
        <p>
          Walkoff isn&apos;t affiliated with any league, team or player. When we set up your brand,
          we note whether you&apos;re licensed to use your teams&apos; names and marks. Most brands
          aren&apos;t.
        </p>
        <p>
          Without a license, campaign copy never names a team, league, player, stadium or event,
          and never implies an endorsement. It nods with the colors, and the city for pro teams,
          through your own products.{" "}
          <Link href={helpPath("campaigns", "copy-rules")}>The copy rules</Link>
        </p>
        <p>Walkoff&apos;s rules lower the risk but aren&apos;t legal advice.</p>
      </HelpSection>

      <HelpSection page={P} id="athletes">
        <p>
          Walkoff keeps public facts about the athletes it follows: their team, position and where
          they&apos;re from, from ESPN, Wikidata and our own research. No birth dates, ages or
          photos.
        </p>
        <p>
          When you ask Claude which athletes are from near your customers, you see their names.
          Those are for you. Campaign copy never names or describes an athlete: no name, number,
          position, school or photo. The one exception is an athlete who agreed in writing that your
          brand may name them, with the agreement on file with Walkoff.
        </p>
      </HelpSection>
    </HelpPage>
  );
}
