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
          Walkoff works from counts, not customer lists. Your browser turns each export into
          customers, orders and revenue per postal area before anything is sent, and Walkoff
          refuses anything finer.
        </p>
        <p>
          So Walkoff never has your customers&apos; names, emails or addresses, and there&apos;s
          no customer list to leak. Klaviyo, which already has your list, does the sending.
        </p>
        <p>
          Product files hold product details only.{" "}
          <Link href={helpPath("uploads", "what-leaves")}>What leaves your browser</Link>
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
          Your upload link is private to your brand. Anyone with it can upload files for your
          brand and see your fan map. Walkoff sends it only to the people invited to your brand,
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
          send without your go-ahead.
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
    </HelpPage>
  );
}
