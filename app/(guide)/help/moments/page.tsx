import Link from "next/link";
import { Ask } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { FinishTable, LeagueTable, MomentTables } from "@/components/help/moments";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { DEFAULT_RULE, WINDOW_HOURS } from "@/lib/mcp/queue";
import { TRIGGERS } from "@/lib/triggers";

export const metadata = helpMetadata("moments");

const P = "moments";

const live = TRIGGERS.filter((t) => !t.coming).length;
const coming = TRIGGERS.length - live;

export default function MomentsPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="types">
        <p>
          Walkoff watches for {live} kinds of moments: before, during and after each game, and
          across the season. {coming} more are coming.
        </p>
        <MomentTables />
        <h3>Big finishes, by sport</h3>
        <p>A last-second finish means something different in each sport:</p>
        <FinishTable />
        <p>
          Moment headlines name the teams, for your eyes. Campaign copy follows your{" "}
          <Link href={helpPath("campaigns", "copy-rules")}>copy rules</Link>.
        </p>
      </HelpSection>

      <HelpSection page={P} id="leagues">
        <p>Walkoff watches every game in these leagues, around the clock.</p>
        <LeagueTable />
        <p>
          In sports with a game most days, an ordinary win counts as a smaller moment, so fans
          don&apos;t hear from you after every one. Walk-offs, comebacks and rivalry wins make the
          cut in every league. Need a league that isn&apos;t here? Ask us.
        </p>
      </HelpSection>

      <HelpSection page={P} id="queue">
        <p>
          Your queue is what to act on now: recent moments that match your triggers, that you
          haven&apos;t drafted, sent or skipped. To see it, ask:
        </p>
        <Ask>What should we send this week?</Ask>
        <ul>
          <li>Most urgent first: moments whose window is closing, then the biggest.</li>
          <li>
            Moments leave once their window closes: a result after about {WINDOW_HOURS.result}{" "}
            hours, a season moment after about {WINDOW_HOURS.season / 24} days, a live one after{" "}
            {WINDOW_HOURS.live} hours, and a pre-game moment at kickoff.
          </li>
          <li>Claude tells you how long each one has left.</li>
        </ul>
      </HelpSection>

      <HelpSection page={P} id="default-rule">
        <p>
          Until you make your own triggers, your queue uses Walkoff&apos;s default rule:{" "}
          <strong>{DEFAULT_RULE.name}</strong>.
        </p>
        <ul>
          <li>It watches your standout teams, and follows them as your map changes.</li>
          <li>
            It takes the moments marked in the tables above. Live moments are left out: setting
            up a campaign takes a few minutes, and a win brings its own moment.
          </li>
          <li>
            It skips moments below an intensity of {DEFAULT_RULE.min_intensity}, like ordinary
            wins in daily sports and narrow losses.
          </li>
        </ul>
      </HelpSection>

      <HelpSection page={P} id="triggers">
        <p>A trigger is your own rule for which moments matter. Ask Claude to make one:</p>
        <Ask>Make a trigger for walk-off and comeback wins in our top markets.</Ask>
        <ul>
          <li>
            <strong>Moments:</strong> which kinds. Leave it empty for any.
          </li>
          <li>
            <strong>Teams:</strong> which teams. Leave it empty to follow your standout teams as
            they change.
          </li>
          <li>
            <strong>Intensity:</strong> skip smaller moments. Walk-offs are about 0.9, close
            losses 0.5.
          </li>
        </ul>
        <p>
          Your own triggers replace the default rule, so make them cover everything you want to
          see. A moment lands in your queue when it matches any of them.
        </p>
        <p>
          Ask &ldquo;What triggers do we have?&rdquo; to see yours, or &ldquo;Delete our rivalry
          trigger.&rdquo; to remove one. Your send history keeps what each one did.
        </p>
        <p>A trigger fills your queue. It never sends anything: you still say go.</p>
      </HelpSection>

      <HelpSection page={P} id="skipping">
        <p>
          Not every moment fits your brand. Tell Claude to skip it, and it leaves your queue.
          Claude logs it as skipped, so your history shows what you passed on.
        </p>
        <Ask>Skip that one.</Ask>
        <p>
          A loss is a judgment call. Walkoff keeps the copy gentle, with no celebrating, and
          suggests skipping it if your brand&apos;s voice is loud.
        </p>
      </HelpSection>
    </HelpPage>
  );
}
