import Link from "next/link";
import { SegmentSteps, SegmentSummary } from "@/components/help/campaign";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { KLAVIYO_ZIP_LIMIT, REACH } from "@/lib/mcp/audience";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { clubAudience, sampleAudience, SAMPLE_TEAM } from "@/lib/help/samples";

export const metadata = helpMetadata("audiences");

const P = "audiences";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function AudiencesPage() {
  const core = sampleAudience();
  const wide = sampleAudience("wide");
  const club = clubAudience();
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="circles">
        <p>
          A team moment goes to that team&apos;s fans, not your whole list. Walkoff draws each
          team&apos;s fan territory as a Klaviyo segment: one to three circles, each a postal code
          and a radius, for Klaviyo&apos;s &ldquo;Someone&apos;s proximity to a location&rdquo;
          condition.
        </p>
        <p>The circles are chosen to cover the team&apos;s core fans and as few other people as possible.</p>
      </HelpSection>

      <HelpSection page={P} id="example">
        <p>For the demo brand, the {SAMPLE_TEAM.team.nickname} segment looks like this:</p>
        <SegmentSummary audience={core} />
        <p>The steps Claude gives you to create it:</p>
        <SegmentSteps audience={core} />
      </HelpSection>

      <HelpSection page={P} id="reach">
        <p>
          <strong>Core</strong>, the default, takes the areas where at least {pct(REACH.core)} of
          the league&apos;s fans follow the team. <strong>Wide</strong> also takes shared markets
          where at least {pct(REACH.wide)} do.
        </p>
        {core.customers && wide.customers ? (
          <p>
            For the demo brand, wide reach for the {SAMPLE_TEAM.team.nickname} adds Los Angeles:{" "}
            {fmt(wide.customers.in_circles)} of its customers instead of{" "}
            {fmt(core.customers.in_circles)}. But only {pct(wide.precision)} of the people inside
            follow the team, against {pct(core.precision)} for core.
          </p>
        ) : null}
        <p>
          Ask for wide when the core audience is small. Walkoff warns you when few of your
          customers live in it. Wide gets its own segment, with &ldquo;(wide)&rdquo; at the end of
          its name.
        </p>
      </HelpSection>

      <HelpSection page={P} id="uk">
        <p>
          Premier League clubs get smaller circles, centered on a postcode district like{" "}
          {club.circles[0]?.postal_code}: for UK postcodes, Klaviyo&apos;s proximity condition
          reads only that first half. Walkoff also lists the club&apos;s districts, if you&apos;d
          rather use Klaviyo&apos;s Zip Code filter. If you do, check the segment isn&apos;t empty
          before you use it.
        </p>
        <SegmentSummary audience={club} />
        <p>
          Klaviyo takes up to {KLAVIYO_ZIP_LIMIT} codes in one condition. For a longer list, the
          steps say how to split it.
        </p>
      </HelpSection>

      <HelpSection page={P} id="save">
        <p>
          Create each team&apos;s segment once. Klaviyo keeps it up to date as your profiles
          change, so every later moment for that team reuses it.
        </p>
        <p>
          Claude looks for the segment by name, so keep the name Walkoff gives it, like
          &ldquo;{core.segment_name}&rdquo;.
        </p>
        <p>
          You can also ask Claude to create it for you with Klaviyo&apos;s connector.{" "}
          <Link href={helpPath("klaviyo", "segments")}>Segments in Klaviyo</Link>
        </p>
      </HelpSection>
    </HelpPage>
  );
}
