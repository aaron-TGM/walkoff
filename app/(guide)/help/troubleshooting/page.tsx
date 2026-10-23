import Link from "next/link";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { TroubleList } from "@/components/help/reference";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { TROUBLE } from "@/lib/help/troubleshooting";

export const metadata = helpMetadata("troubleshooting");

const P = "troubleshooting";

export default function TroubleshootingPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="sign-in">
        <p>
          On Walkoff&apos;s sign-in pages, when you connect it in Claude.{" "}
          <Link href={helpPath("connect", "sign-in")}>How signing in works</Link>
        </p>
        <TroubleList items={TROUBLE["sign-in"]} />
      </HelpSection>

      <HelpSection page={P} id="uploads">
        <p>On your upload page.</p>
        <TroubleList items={TROUBLE.uploads} />
      </HelpSection>

      <HelpSection page={P} id="in-claude">
        <p>
          In Claude&apos;s answers, when it uses Walkoff. For Klaviyo&apos;s side, see{" "}
          <Link href={helpPath("klaviyo", "trouble")}>Klaviyo in Claude</Link>.
        </p>
        <TroubleList items={TROUBLE["in-claude"]} />
      </HelpSection>

      <HelpSection page={P} id="contact">
        <ul>
          <li>
            <Link href="/status">Status</Link> shows whether the engine and every league are
            running.
          </li>
          <li>
            Email <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>, or reply to your
            welcome email. Tell us what you asked and what you saw. A screenshot helps.
          </li>
        </ul>
      </HelpSection>
    </HelpPage>
  );
}
