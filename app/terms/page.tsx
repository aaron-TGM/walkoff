import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service · Walkoff",
  description: "The terms that apply when you use Walkoff.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Service" updated="October 22, 2026">
      <p>
        These terms apply when you use walkoff.io or the Walkoff service
        (&ldquo;Walkoff&rdquo;), operated by Tuff Ghost Media LLC
        (&ldquo;we&rdquo; or &ldquo;us&rdquo;). By using Walkoff you agree to
        them. If you use Walkoff for a company, you confirm you can accept these
        terms on its behalf.
      </p>

      <h2>1. The service</h2>
      <p>
        Walkoff detects real-world moments, such as game results, maps them to
        your customers and products, and triggers messages through the email,
        SMS and AI tools you connect. During early access we may set things up
        for you, and features may change, pause or end as the product develops.
      </p>

      <h2>2. Your account and connected platforms</h2>
      <p>
        Keep your login and API credentials secure and tell us right away if
        you think they&apos;ve been compromised. When you connect a platform
        such as Klaviyo, you authorize us to act in it within the access you
        grant, for example to create segments, events and campaigns.
      </p>

      <h2>3. Your responsibilities</h2>
      <ul>
        <li>
          <strong>Your messages.</strong> You&apos;re responsible for the
          content of your messages and for having the consent the law requires
          to email or text your customers, including under CAN-SPAM, the TCPA,
          the GDPR and similar laws.
        </li>
        <li>
          <strong>Team and league marks.</strong> You&apos;re responsible for
          having the rights to any team, league or player names, logos or other
          marks in your content. Walkoff isn&apos;t affiliated with any league,
          team or player.
        </li>
        <li>
          <strong>Approvals and auto-fire rules.</strong> You&apos;re
          responsible for messages you approve and for messages that send under
          rules you set.
        </li>
        <li>
          <strong>Fair use.</strong> Don&apos;t send us your customers&apos;
          personal details beyond what we ask for, use Walkoff for anything
          unlawful or for spam, try to break or reverse engineer it, or resell
          it without our permission.
        </li>
      </ul>

      <h2>4. Your data</h2>
      <p>
        You own the data you give us. You let us use it to provide and support
        Walkoff for you. We may also create aggregated, de-identified data,
        such as how a type of moment performs, to improve Walkoff and build
        benchmarks. That data never identifies you or your customers. Our{" "}
        <Link href="/privacy">Privacy Policy</Link> explains how we handle
        information.
      </p>

      <h2>5. Real-world data</h2>
      <p>
        Scores, schedules, weather and other real-world data come from third
        party and public sources and can be late, incomplete or wrong. We
        don&apos;t guarantee that any moment will be detected, or that any
        message will send at a particular time.
      </p>

      <h2>6. Fees, trials and cancellation</h2>
      <p>
        Fees are shown on our pricing page or in your order. Free trials last
        the length shown when you sign up and don&apos;t require a credit card.
        Paid plans are billed in advance, monthly or yearly. You can cancel any
        time, effective at the end of your current billing period. Except where
        the law says otherwise, we don&apos;t refund partial periods. We&apos;ll
        give you at least 30 days&apos; notice before changing your price.
      </p>

      <h2>7. Our property</h2>
      <p>
        Walkoff&apos;s software, content and brand belong to us. If you send us
        feedback or ideas, we can use them without owing you anything.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        Walkoff is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;
        To the extent the law allows, we disclaim all warranties, express or
        implied, including merchantability, fitness for a particular purpose
        and non-infringement. We don&apos;t promise any particular sales,
        revenue or results.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the extent the law allows, we aren&apos;t liable for indirect,
        incidental, special, consequential or punitive damages, or for lost
        profits, revenue or data. Our total liability for any claim is limited
        to the amount you paid us in the 12 months before the claim, or $100 if
        you haven&apos;t paid us anything.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You&apos;ll defend and indemnify Tuff Ghost Media LLC against claims
        arising from your content, your messages, your use of any team, league
        or player marks, or your breach of these terms or the law.
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        We may suspend or end your access if you break these terms or put
        Walkoff, other customers or the public at risk. You can stop using
        Walkoff at any time. Sections 3 through 10 survive termination.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of California. Any
        dispute will be handled in the state or federal courts in Orange
        County, California.
      </p>

      <h2>13. Changes and contact</h2>
      <p>
        If we change these terms, we&apos;ll post the new version here and
        update the date above. Continuing to use Walkoff after a change means
        you accept it. Questions go to{" "}
        <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>.
      </p>
    </LegalPage>
  );
}
