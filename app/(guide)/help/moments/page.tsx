import Link from "next/link";
import { Ask } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { FinishTable, LeagueTable, MomentTables } from "@/components/help/moments";
import { SIGNING_TOP, TOUR_FACTS } from "@/lib/help/moments";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { DEFAULT_RULE, LOCAL, WINDOW_HOURS } from "@/lib/mcp/queue";
import { brandTriggers } from "@/lib/triggers";

export const metadata = helpMetadata("moments");

const P = "moments";

export default function MomentsPage() {
  const triggers = brandTriggers();
  const live = triggers.filter((t) => !t.coming).length;
  const coming = triggers.length - live;
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
        <h3>Big signings</h3>
        <p>
          Walkoff reads every team&apos;s roster each day. When a star joins a new team, by trade,
          signing or transfer, that team&apos;s fans get a Big Signing. A star is one of their
          league&apos;s {SIGNING_TOP} best-known players: Walkoff counts the Wikipedias with a page
          about them. Copy never names the player.
        </p>
        <p>
          Moment headlines name the teams, for your eyes. Campaign copy follows your{" "}
          <Link href={helpPath("campaigns", "copy-rules")}>copy rules</Link>.
        </p>
      </HelpSection>

      <HelpSection page={P} id="hometown">
        <p>
          When an athlete from a town near your customers wins, the town gets its own moment.
          Walkoff watches for:
        </p>
        <ul>
          <li>
            <strong>Titles.</strong> Everyone on the champion&apos;s roster, from the Super Bowl to
            the Stanley Cup.
          </li>
          <li>
            <strong>Playoff games won at the very end.</strong> Whoever hit the walk-off, made the
            buzzer-beater or scored in overtime.
          </li>
          <li>
            <strong>Tour wins.</strong> Whoever wins on these tours. In golf, also whoever is in
            contention going into the final round, and in tennis, whoever plays in the final.
            <ul>
              {TOUR_FACTS.map((t) => (
                <li key={t.sport}>
                  {t.sport}: {t.tours}
                </li>
              ))}
            </ul>
          </li>
        </ul>
        <p>
          Walkoff knows where athletes are from by their high school, where they were born and
          our own research. When it isn&apos;t sure, it makes no moment.
        </p>
        <p>A town&apos;s moment reaches you when enough of your customers live around it:</p>
        <ul>
          <li>
            About {LOCAL.minCustomers} or more of your customers, or {LOCAL.minWithLift} or more
            when that&apos;s {LOCAL.minLift} times the town&apos;s share of people.
          </li>
          <li>
            From one event, up to {LOCAL.townsPerEvent} towns, starting with whoever did the most.
            Claude names the rest.
          </li>
          <li>
            Big cities are left out. A hometown moment is for a town, and a city&apos;s fans hear
            from you through its teams.
          </li>
          <li>
            A town in the champion&apos;s own territory is left out when the team&apos;s own
            moment already reaches it, so nobody hears from you twice.
          </li>
        </ul>
        <p>
          The campaign goes to one circle around the town, never your whole list. Its copy
          celebrates the town, in the colors everyone there is wearing. It never names or
          describes the athlete.{" "}
          <Link href={helpPath("campaigns", "copy-rules")}>Copy rules</Link>
        </p>
        <p>To see who&apos;s from near your customers, ask:</p>
        <Ask>Which athletes are from near our customers?</Ask>
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
          <li>
            <strong>Towns:</strong> for hometown moments in and near the towns you name, like San
            Clemente, CA. A trigger with towns takes only hometown moments.
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
