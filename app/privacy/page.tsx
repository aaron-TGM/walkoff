import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy · Walkoff",
  description: "How Walkoff collects, uses and protects information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated="October 27, 2026">
      <p>
        Walkoff (walkoff.io) is a product of Tuff Ghost Media LLC, based in San
        Clemente, California (&ldquo;Walkoff,&rdquo; &ldquo;we&rdquo; or
        &ldquo;us&rdquo;). This policy explains what we collect, why we collect
        it and the choices you have. Questions go to{" "}
        <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Early access requests.</strong> Your company, email address,
          website, role, email platform, and the leagues, teams or markets you
          tell us about. We also keep how you found us: the campaign tags on
          the link you followed, the site that sent you, the first page you
          visited and the button you clicked.
        </li>
        <li>
          <strong>Data you give us to run the service.</strong> Aggregated
          counts (such as postal code, product category, number of customers
          and revenue), product catalog details, and access credentials for the
          platforms you connect, such as Klaviyo.
        </li>
        <li>
          <strong>Sign-in details.</strong> If you connect Walkoff to Claude or
          another AI agent: your work email, to send you a one-time sign-in
          code, and a record of the access you approved, kept only as hashed
          tokens.
        </li>
        <li>
          <strong>Results.</strong> Performance data your connected platforms
          report back, such as sends, clicks, attributed orders and revenue.
        </li>
        <li>
          <strong>Technical data.</strong> Our hosting provider logs standard
          request information (IP address, browser type, pages requested) for
          security and reliability.
        </li>
        <li>
          <strong>Public information about athletes.</strong> Facts about the
          athletes in the leagues and on the tours Walkoff follows, such as
          where they&apos;re from. See{" "}
          <a href="#athletes">Information about athletes</a>.
        </li>
        <li>
          <strong>Site analytics.</strong> We count visits to walkoff.io with
          Vercel Web Analytics: the pages viewed, the site that sent you, and
          your browser, device type and general location. It sets no cookies
          and doesn&apos;t identify you, and private links, such as a
          brand&apos;s upload link, are removed before anything is counted.
        </li>
      </ul>
      <p>
        Walkoff is designed to work from counts, not customer lists. Please
        don&apos;t send us names, email addresses or other personal details
        of your customers. If a file includes them by mistake, we delete those
        fields.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide, maintain and improve Walkoff.</li>
        <li>To respond to early access requests and support questions.</li>
        <li>To learn which pages and campaigns bring people to Walkoff.</li>
        <li>To keep the service secure and prevent abuse.</li>
        <li>To meet legal obligations.</li>
        <li>
          To build aggregated, de-identified benchmarks, such as how a type of
          moment performs for a type of brand. Benchmarks never identify you or
          your customers.
        </li>
      </ul>

      <h2>How we share it</h2>
      <p>
        We don&apos;t sell personal information or share it for cross-context
        behavioral advertising. We share information only with:
      </p>
      <ul>
        <li>
          <strong>Service providers</strong> that run parts of Walkoff for us
          under confidentiality obligations: hosting and site analytics
          (Vercel), database
          (Supabase), email delivery (Resend) and AI processing (Anthropic),
          which we use to analyze product catalogs and counts.
        </li>
        <li>
          <strong>Platforms you connect</strong>, when you tell us to, such as
          creating segments or sending campaigns in your Klaviyo account.
        </li>
        <li>
          <strong>Brands using Walkoff</strong>, who see the names, teams and
          towns of the athletes behind their moments. Those are for their own
          eyes, not for their campaigns.
        </li>
        <li>
          <strong>Authorities</strong>, when the law requires it.
        </li>
        <li>
          <strong>A successor</strong>, if Walkoff or Tuff Ghost Media LLC is
          involved in a merger, acquisition or sale of assets.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep early access information until you ask us to delete it. We keep
        brand data for as long as your account is active and delete it within
        30 days after you cancel, unless the law requires us to keep it longer.
      </p>

      <h2 id="athletes">Information about athletes</h2>
      <p>
        Walkoff follows the athletes in the leagues and on the tours it covers.
        When one of them wins, brands with customers in and around their
        hometown can celebrate the town. For each athlete we keep:
      </p>
      <ul>
        <li>
          <strong>Roster facts.</strong> Name, the ids ESPN and Wikidata use
          for them or their Wikipedia article, sport, team or tour, position,
          jersey number, college, and the team they last played for.
        </li>
        <li>
          <strong>Where they&apos;re from.</strong> Their birthplace, high
          school and hometown, the town each one points to, and where we
          learned it.
        </li>
        <li>
          <strong>Results.</strong> What they won or played a part in, such as
          a title, a tournament or a playoff game.
        </li>
        <li>
          <strong>How well known they are.</strong> How many Wikipedia and
          other Wikimedia sites have a page about them.
        </li>
        <li>
          <strong>Written agreements.</strong> When an athlete agrees in
          writing that a brand may name them, the agreement&apos;s dates and
          where it&apos;s kept.
        </li>
      </ul>
      <p>
        It comes from public sources: ESPN, Wikipedia, Wikidata, the results
        and profiles that leagues and tours publish, and our own research of
        public reporting. We don&apos;t keep birth dates, ages, photos or contact
        details.
      </p>
      <p>
        We use it to find hometown moments and big signings, and to show
        marketers which
        athletes are from near their customers and why a moment is in their
        queue. Campaigns celebrate the town and never name or describe an
        athlete, unless the athlete agreed in writing that the brand may. Where
        the GDPR applies, we rely on our legitimate interest in celebrating
        local sports success.
      </p>
      <p>
        We keep it for as long as Walkoff follows the athlete&apos;s league or
        tour. Results stay as the record behind the moments they made.
      </p>
      <p>
        If you&apos;re an athlete, or you represent one, email{" "}
        <a href="mailto:hello@walkoff.io">hello@walkoff.io</a> to see what we
        keep about you, to correct where you&apos;re from, or to have us stop
        using you. When you ask us to stop, we delete where you&apos;re from,
        never keep it again, stop making hometown moments and big signings
        about you, and take back the ones still in brands&apos; queues. We keep
        your roster facts, so we know you when a roster lists you again.
      </p>

      <h2 id="security">Security</h2>
      <p>
        We encrypt data in transit, keep only hashed versions of sign-in
        tokens, and never hold your Klaviyo or Shopify keys: your own
        connectors in Claude do that work. We keep every brand&apos;s data
        separate from every other brand&apos;s. Only the
        people who run Walkoff can reach it. No system is perfectly secure, so
        if we learn of a breach that affects your information, we&apos;ll tell
        you promptly. Report security issues to{" "}
        <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your information, or object to
        how we use it, by emailing{" "}
        <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>. We respond
        within the time the law requires and won&apos;t treat you differently
        for asking.
      </p>
      <ul>
        <li>
          <strong>California residents</strong> have the right to know, delete
          and correct personal information, and to opt out of its sale or
          sharing. We don&apos;t sell or share it.
        </li>
        <li>
          <strong>EU and UK residents</strong> have rights under the GDPR,
          including access, correction, deletion, restriction, portability and
          objection. We process information to perform our contract with you,
          for our legitimate interests in running and improving Walkoff, or
          with your consent. Data is processed in the United States.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        Walkoff is a business service and isn&apos;t meant for anyone under 16.
        We don&apos;t knowingly collect information from children. The
        athletes Walkoff follows play in college and professional leagues and
        on professional tours. If we learn one is under 16, we stop using
        them.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&apos;ll post the new version here and
        update the date above. Significant changes will also be sent to
        customers by email.
      </p>

      <h2>Contact</h2>
      <p>
        Tuff Ghost Media LLC &middot; San Clemente, California &middot;{" "}
        <a href="mailto:hello@walkoff.io">hello@walkoff.io</a>
      </p>
    </LegalPage>
  );
}
