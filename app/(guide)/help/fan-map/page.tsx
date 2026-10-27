import Link from "next/link";
import { Ask } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { AffinityReportView, Swatches } from "@/components/upload/AffinityReportView";
import { PRODUCT, STANDOUT } from "@/lib/affinity/compute";
import { DEMO_BRAND } from "@/lib/affinity/demo";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { demoReport, SAMPLE_TEAM } from "@/lib/help/samples";

export const metadata = helpMetadata("fan-map");

const P = "fan-map";

export default function FanMapPage() {
  const report = demoReport();
  const team = report.standouts.find((g) => `${g.league}:${g.teamId}` === SAMPLE_TEAM.key);
  const buys = report.standouts.find((g) => g.products.length)?.products[0];
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="lift">
        <p>
          Every league has fan territories: the areas where most people follow each team.
          Walkoff counts how many of your customers live in each team&apos;s territory, and
          compares that with how many people live there.
        </p>
        <p>
          That ratio is the lift. A lift of 2.4&times; means 2.4 times more of your customers live
          in that territory than its population alone predicts. A lift of 1&times; means
          you&apos;re as common there as anywhere else.
        </p>
        <p>Where fans of two teams share an area, its customers are split the way its fans are.</p>
      </HelpSection>

      <HelpSection page={P} id="standouts">
        <p>A territory is a standout when all of these are true:</p>
        <ul>
          <li>The lift is at least {STANDOUT.minLift}&times;.</li>
          <li>At least {STANDOUT.minCustomers} of your customers live there.</li>
          <li>
            The difference is too big to be chance: a z-score of {STANDOUT.minZ} or more.
          </li>
        </ul>
        <p>
          Walkoff keeps up to {STANDOUT.max}, strongest first. Your standout teams drive the
          rest: the default rule watches their moments, and Claude uses them when you don&apos;t
          name a team.
        </p>
        <p>
          No standouts? Your customers are spread much like the population. That&apos;s useful
          too: national moments reach them everywhere, and you can name any team in your asks.
        </p>
      </HelpSection>

      <HelpSection page={P} id="buys">
        <p>
          With an orders export, Walkoff also sees what each territory buys more of than your
          customers overall.
          {buys ? (
            <>
              {" "}
              For the demo brand, &ldquo;{buys.product} ({buys.lift}&times;)&rdquo; means
              it&apos;s {buys.lift} times as big a part of what fans there buy as it is for your
              customers overall.
            </>
          ) : null}
        </p>
        <p>
          A product needs at least {PRODUCT.minOrders} orders in the territory and a lift of{" "}
          {PRODUCT.minLift}&times; to count. Each territory shows its top {PRODUCT.max}.
        </p>
        <p>
          A map set up from Shopify in Claude shows where your customers are, not what they buy.
          For this part, upload an orders export too.{" "}
          <Link href={helpPath("uploads", "files")}>Which files</Link>
        </p>
      </HelpSection>

      <HelpSection page={P} id="picks">
        <p>
          For each standout team, Walkoff picks what to feature when the team has a moment:
          anything made for its fans first, then the colorways closest to the team&apos;s colors,
          one per team color. No logo or license needed.
        </p>
        {team?.picks?.length ? (
          <p>
            For the demo brand, a {SAMPLE_TEAM.team.nickname} win features{" "}
            {team.picks.slice(0, 2).map((p, i) => (
              <span key={p.title}>
                {i ? " and " : ""}
                the {p.title} in {p.colorway}
                <Swatches hex={p.hex} />
              </span>
            ))}
            : {team.picks
              .slice(0, 2)
              .map((p) => p.why.toLowerCase())
              .join(", and ")}
            .
          </p>
        ) : null}
        <p>To see picks for any team, ask:</p>
        <Ask>What should we feature if the Padres win?</Ask>
      </HelpSection>

      <HelpSection page={P} id="example">
        <p>
          This is the map for {DEMO_BRAND}, a sample Southern California brand with no team
          license and a following in Wisconsin it wouldn&apos;t have guessed, made by the same
          code as yours.
        </p>
        <div className="help-report">
          <AffinityReportView report={report} />
        </div>
      </HelpSection>
    </HelpPage>
  );
}
