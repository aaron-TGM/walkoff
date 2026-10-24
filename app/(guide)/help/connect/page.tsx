import Link from "next/link";
import { Callout, CopyLine } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { CONNECTOR_STEPS, CONNECTOR_URL, ORG_CONNECTOR_STEPS, STEPS_CHECKED } from "@/lib/connect";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { LIMITS, TTL } from "@/lib/mcp/oauth/config";

export const metadata = helpMetadata("connect");

const P = "connect";

export default function ConnectPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="claude">
        <p>
          Walkoff is an MCP server, so Claude connects to it like any other connector. You sign
          in with your work email.
        </p>
        <ol>
          <li>
            In Claude, go to <strong>{CONNECTOR_STEPS}</strong>.
          </li>
          <li>
            Enter this address. If Claude asks for a name, use Walkoff.
            <CopyLine>{CONNECTOR_URL}</CopyLine>
          </li>
          <li>Add it and connect. Claude opens Walkoff&apos;s sign-in page.</li>
          <li>
            Sign in with the email you were invited with, then pick your brands.
          </li>
        </ol>
        <p>
          Connect Shopify and Klaviyo too, if you haven&apos;t. Claude sets your brand up from
          your Shopify store, and drafts campaigns with your Klaviyo connector, in your own
          account. <Link href={helpPath("shopify", "connect")}>Connecting Shopify</Link> &middot;{" "}
          <Link href={helpPath("klaviyo", "connect")}>Connecting Klaviyo</Link>
        </p>
        <Callout>
          <p>
            These steps were checked against Claude in {STEPS_CHECKED}. If the menus have moved,
            look for Connectors in Claude&apos;s settings.
          </p>
        </Callout>
      </HelpSection>

      <HelpSection page={P} id="teams">
        <p>
          On a Team or Enterprise plan, an owner adds Walkoff for the whole organization first,
          under <strong>{ORG_CONNECTOR_STEPS}</strong>, with the same address.
        </p>
        <p>
          Then each person connects it and signs in with their own email. Everyone sees only the
          brands they were invited to.
        </p>
      </HelpSection>

      <HelpSection page={P} id="claude-code">
        <p>Add Walkoff from your terminal:</p>
        <CopyLine>{`claude mcp add --transport http walkoff ${CONNECTOR_URL}`}</CopyLine>
        <p>
          Then run <code>/mcp</code> in Claude Code and pick Walkoff to sign in. The sign-in
          opens in your browser.
        </p>
      </HelpSection>

      <HelpSection page={P} id="sign-in">
        <p>
          Walkoff doesn&apos;t use passwords. Enter the email you were invited with, and Walkoff
          emails you a 6-digit code.
        </p>
        <ul>
          <li>The code works for {TTL.request / 60} minutes.</li>
          <li>
            You get {LIMITS.attempts} tries at each code, and up to {LIMITS.codesSent} codes per
            sign-in.
          </li>
          <li>
            Only invited addresses get a code. The page looks the same either way, so nobody can
            use it to find out who has access.
          </li>
          <li>
            Once you&apos;re in, Claude stays signed in. It renews access by itself, as long as
            you use Walkoff at least once every {TTL.refresh / 86_400} days.
          </li>
        </ul>
        <p>
          No code? See <Link href={helpPath("troubleshooting", "sign-in")}>Troubleshooting</Link>.
        </p>
      </HelpSection>

      <HelpSection page={P} id="brands">
        <p>
          After the code, Walkoff shows the brands you were invited to. Pick the ones Claude can
          use with this connection. With one brand, there&apos;s nothing to pick.
        </p>
        <p>When you have more than one brand, say which one in your ask.</p>
      </HelpSection>

      <HelpSection page={P} id="another-brand">
        <p>
          A sign-in reaches the brands you picked when you made it. If you&apos;re invited to
          another brand later, it won&apos;t show up in Claude until you connect again:
        </p>
        <ol>
          <li>Disconnect Walkoff in Claude&apos;s connector settings.</li>
          <li>Connect it again and sign in.</li>
          <li>Pick every brand you want, the new one included.</li>
        </ol>
        <p>The welcome email for the new brand reminds you.</p>
      </HelpSection>

      <HelpSection page={P} id="disconnect">
        <p>
          Disconnect Walkoff in Claude&apos;s connector settings, and Claude stops using it.
          Connect again any time.
        </p>
        <p>
          When someone leaves your team, ask your Walkoff contact to remove them. Their access
          ends on their next request, even if they never disconnect. If they had your upload
          link, ask us to replace it too.{" "}
          <Link href={helpPath("data-and-safety", "upload-link")}>About the link</Link>
        </p>
      </HelpSection>
    </HelpPage>
  );
}
