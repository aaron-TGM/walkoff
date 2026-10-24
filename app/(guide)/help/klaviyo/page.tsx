import Link from "next/link";
import { Ask, Callout, CopyLine, HelpFaq } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { CONNECTOR_STEPS, CONNECTORS_PAGE, ORG_CONNECTOR_STEPS } from "@/lib/connect";
import { KLAVIYO, KLAVIYO_FLOW, TRACKING } from "@/lib/help/klaviyo";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { clubAudience, sampleAudience, sampleCampaign } from "@/lib/help/samples";

export const metadata = helpMetadata("klaviyo");

const P = "klaviyo";

/** "Owner, Admin or Manager" */
const either = (xs: readonly string[]) => `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;

export default function KlaviyoPage() {
  const segment = sampleAudience().segment_name;
  const district = clubAudience().circles[0]?.postal_code;
  const campaignName = sampleCampaign().campaign_name;
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="why">
        <p>
          Walkoff builds the campaign. Claude puts it in your Klaviyo account with Klaviyo&apos;s
          own connector, signed in as you. Here&apos;s what it does, in order:
        </p>
        <div className="help-table-wrap">
          <table className="help-table help-table-stack">
            <thead>
              <tr>
                <th>Claude</th>
                <th>Klaviyo tool</th>
                <th>Changes in your account</th>
              </tr>
            </thead>
            <tbody>
              {KLAVIYO_FLOW.map((f) => (
                <tr key={f.step}>
                  <td>{f.step}</td>
                  <td data-label="Klaviyo tool">
                    {f.tools.map((t, i) => (
                      <span key={t}>
                        {i ? ", " : ""}
                        <code>{t}</code>
                      </span>
                    ))}
                  </td>
                  <td data-label="Changes">{f.changes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Smart Sending stays on, so nobody who just heard from you gets another email. Walkoff
          tells Claude never to schedule or send without your go-ahead, and you can always
          schedule it yourself in Klaviyo instead.
        </p>
      </HelpSection>

      <HelpSection page={P} id="connect">
        <ol>
          <li>
            In Claude, go to <strong>{CONNECTORS_PAGE}</strong>, browse the connectors and find
            Klaviyo.
          </li>
          <li>
            Connect it, and sign in to Klaviyo. Use the Klaviyo account for this brand: if
            Klaviyo shows Select Account, pick it there.
          </li>
          <li>Review the permissions and click Allow.</li>
        </ol>
        <ul>
          <li>Your Klaviyo role needs to be {either(KLAVIYO.roles)}.</li>
          <li>
            On a Team or Enterprise plan, an owner may need to add Klaviyo for your organization
            first, under {ORG_CONNECTOR_STEPS}.
          </li>
          <li>
            If Claude doesn&apos;t use it, check Klaviyo is turned on in the chat&apos;s + menu,
            under Connectors.
          </li>
        </ul>
        <Callout>
          <p>
            These steps follow{" "}
            <a href={KLAVIYO.docs.connect} target="_blank" rel="noopener">
              Klaviyo&apos;s own guide
            </a>
            , checked in {KLAVIYO.checked}. Klaviyo&apos;s page has the latest.
          </p>
        </Callout>
      </HelpSection>

      <HelpSection page={P} id="accounts">
        <p>
          Agencies, and anyone with several brands, add Klaviyo once per Klaviyo account, as a
          custom connector:
        </p>
        <ol>
          <li>
            In Claude, go to <strong>{CONNECTOR_STEPS}</strong>.
          </li>
          <li>Name it for the brand, like &ldquo;Klaviyo - Sample Athleisure&rdquo;.</li>
          <li>
            Enter Klaviyo&apos;s address, with the account&apos;s name at the end in place of
            your-company (%20 for a space):
            <CopyLine>{`${KLAVIYO.mcpUrl}?company=your-company`}</CopyLine>
          </li>
          <li>Connect, sign in to that Klaviyo account and click Allow.</li>
        </ol>
        <p>
          In each chat, turn on only the Klaviyo for the brand you&apos;re working on (+ →
          Connectors), next to Walkoff. Custom connectors need a {either(KLAVIYO.customPlans)}{" "}
          plan.
        </p>
      </HelpSection>

      <HelpSection page={P} id="settings">
        <ul>
          <li>
            <strong>Leave read-only mode off.</strong> Klaviyo&apos;s connector can run read-only
            (read-only=true in a custom connector&apos;s address). Then Claude can&apos;t create
            the segment, the template or the draft.
          </li>
          <li>
            <strong>Choose what needs your OK.</strong> In Claude&apos;s settings for the Klaviyo
            connector, you can block tools, or have Claude ask before it uses the ones that make
            changes. Worth it for sending.
          </li>
          <li>
            <strong>A/B tests and Smart Send Time.</strong> Klaviyo&apos;s connector can&apos;t
            send campaigns that use them, so schedule those in Klaviyo. Walkoff&apos;s drafts use
            neither: they go at a set time, with Smart Sending on.
          </li>
          <li>
            <strong>Turn on UTM tracking.</strong> Then Shopify, Google Analytics and Triple Whale
            can credit Walkoff&apos;s sends. <Link href={helpPath("klaviyo", "tracking")}>Tracking and results</Link>
          </li>
        </ul>
      </HelpSection>

      <HelpSection page={P} id="segments">
        <p>
          A team moment goes to that team&apos;s fans. In Klaviyo that&apos;s a segment, saved
          once per team, and every later moment for the team reuses it.
        </p>
        <ul>
          <li>
            The first time Claude needs one, it offers to create it with Klaviyo&apos;s connector.
            Say OK and it&apos;s done: Walkoff hands Claude the segment, ready to go.
          </li>
          <li>
            Rather do it yourself? Claude gives you the steps instead: Lists &amp; segments, then
            Create → Segment, then one to three &ldquo;Someone&apos;s proximity to a
            location&rdquo; conditions. <Link href={helpPath("audiences", "example")}>An example</Link>
          </li>
          <li>
            Keep the name Walkoff gives it, like &ldquo;{segment}&rdquo;. Claude finds it by name
            next time.
          </li>
          <li>Look at it once in Klaviyo before your first send.</li>
          <li>
            A customer counts only if their Klaviyo profile has a zip code and country, or a
            location Klaviyo can place.
          </li>
          {district ? (
            <li>
              For UK clubs, Klaviyo reads only the first half of a postcode, like {district}, so
              Walkoff&apos;s steps use that.
            </li>
          ) : null}
        </ul>
      </HelpSection>

      <HelpSection page={P} id="tracking">
        <p>
          Walkoff&apos;s emails are ordinary Klaviyo campaigns, so the tracking you already use
          sees them. There&apos;s nothing to tag by hand.
        </p>
        <ul>
          <li>
            <strong>Turn on UTM tracking in Klaviyo, once.</strong> Click your account name, then{" "}
            {TRACKING.utmSettings}. Klaviyo then adds UTM parameters to the links in your
            emails, and Claude turns them on for each Walkoff draft. Shopify, Google Analytics and
            Triple Whale read them to credit the sales.
          </li>
          <li>
            <strong>Use Triple Whale?</strong> Keep the UTM settings from{" "}
            <a href={TRACKING.tripleWhale.setup} target="_blank" rel="noopener">
              its Klaviyo guide
            </a>
            . Walkoff&apos;s sends show up there like your other Klaviyo campaigns.
          </li>
          <li>
            <strong>Your Meta pixel needs nothing.</strong> It sees the visits and orders your
            emails bring. Meta credits only its own ads, so email won&apos;t show in Meta&apos;s
            results either way.
          </li>
          <li>
            <strong>Find them by name.</strong> Every Walkoff campaign&apos;s name starts with
            &ldquo;Walkoff ·&rdquo;, like &ldquo;{campaignName}&rdquo;.
          </li>
        </ul>
        <p>To see how your sends did, ask Claude:</p>
        <Ask>How did our Walkoff sends do last month?</Ask>
        <p>
          Claude takes each send from your history and reads its numbers from Klaviyo:
          recipients, clicks, orders and revenue. They&apos;re Klaviyo&apos;s numbers, counted by
          your Klaviyo attribution settings. Walkoff doesn&apos;t keep them: Claude reads them
          fresh from Klaviyo each time.
        </p>
        <Callout>
          <p>
            These steps follow{" "}
            <a href={KLAVIYO.docs.utm} target="_blank" rel="noopener">
              Klaviyo&apos;s guide to UTM tracking
            </a>
            , checked in {KLAVIYO.checked}.
          </p>
        </Callout>
      </HelpSection>

      <HelpSection page={P} id="trouble">
        <HelpFaq
          items={[
            {
              id: "no-segment",
              q: "Claude can't find the segment.",
              a: (
                <p>
                  It looks for the exact name, like &ldquo;{segment}&rdquo;. Check the name in
                  Klaviyo, and that Claude is connected to the right Klaviyo account. New team?
                  Say OK when Claude offers to create the segment.
                </p>
              ),
            },
            {
              id: "no-create",
              q: "Claude couldn't create the segment.",
              a: (
                <p>
                  Check your Klaviyo role is {either(KLAVIYO.roles)}, and that read-only mode is off.
                  Klaviyo also creates at most {KLAVIYO.segmentsPerDay} segments a day per account.
                  You can always create it from the steps Claude gives you.
                </p>
              ),
            },
            {
              id: "no-draft",
              q: "Claude can't create the draft.",
              a: (
                <p>
                  Check your Klaviyo role is {either(KLAVIYO.roles)}. With a custom connector, make
                  sure its address doesn&apos;t include read-only or core-tools-only, which hide
                  tools Claude needs.
                </p>
              ),
            },
            {
              id: "wrong-account",
              q: "Claude is using the wrong Klaviyo account.",
              a: (
                <p>
                  Disconnect Klaviyo in Claude&apos;s connector settings and connect again, picking
                  the right account when Klaviyo asks. With several accounts, turn on only the one
                  you want in each chat.
                </p>
              ),
            },
            {
              id: "small-segment",
              q: "The segment is smaller than I expected.",
              a: (
                <p>
                  Klaviyo counts only profiles with a zip code and country, or a location it can
                  place. Walkoff&apos;s numbers come from your Shopify counts or uploads, so the two can differ.
                </p>
              ),
            },
            {
              id: "not-set",
              q: "Our Walkoff sends show up as direct, or (not set), in our analytics.",
              a: (
                <p>
                  Their links had no UTM parameters. Turn on UTM tracking in Klaviyo, under{" "}
                  {TRACKING.utmSettings}, and check &ldquo;{TRACKING.campaignSwitch}&rdquo; is on
                  in the campaign. Emails already sent stay as they are.
                </p>
              ),
            },
            {
              id: "numbers-differ",
              q: "Klaviyo and Triple Whale show different revenue.",
              a: (
                <p>
                  Each counts orders its own way. Klaviyo credits an email by your Klaviyo
                  attribution settings, and Triple Whale uses its own pixel and model.{" "}
                  <a href={TRACKING.tripleWhale.differences} target="_blank" rel="noopener">
                    Triple Whale explains the difference
                  </a>
                  .
                </p>
              ),
            },
          ]}
        />
        <p>
          More: <Link href={helpPath("troubleshooting")}>Troubleshooting</Link>, and{" "}
          <a href={KLAVIYO.docs.agencies} target="_blank" rel="noopener">
            Klaviyo&apos;s guide to its connector
          </a>
          .
        </p>
      </HelpSection>
    </HelpPage>
  );
}
