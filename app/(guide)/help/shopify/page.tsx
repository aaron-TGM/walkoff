import Link from "next/link";
import { Ask, Callout, CopyLine, ExampleSession, HelpFaq } from "@/components/help/blocks";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { CONNECTORS_PAGE, ORG_CONNECTOR_STEPS } from "@/lib/connect";
import { helpMetadata, helpPath } from "@/lib/help/pages";
import { SESSIONS } from "@/lib/help/sessions";
import { SHOPIFY } from "@/lib/help/shopify";

export const metadata = helpMetadata("shopify");

const P = "shopify";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function ShopifyPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="connect">
        <p>
          Walkoff sets your brand up in Claude, with the Shopify connector you may already use.
          There are no files to export or upload.
        </p>
        <ol>
          <li>
            In Claude, go to <strong>{CONNECTORS_PAGE}</strong>, browse the connectors and find
            Shopify. Or ask Claude for Shopify. Use a desktop browser for this part.
          </li>
          <li>Sign in to your Shopify admin and approve the access Claude asks for.</li>
          <li>
            Use a Shopify account that can see your store&apos;s reports. Claude reads your
            customer counts from Shopify&apos;s analytics with it.
          </li>
        </ol>
        <ul>
          <li>
            The connector works with the store you connect. Ask Claude which store that is. You
            can switch to another store you own.
          </li>
          <li>
            On a Team or Enterprise plan, an owner may need to add Shopify for your organization
            first, under {ORG_CONNECTOR_STEPS}.
          </li>
          <li>
            Connect Walkoff and Klaviyo too, if you haven&apos;t:{" "}
            <Link href={helpPath("connect")}>Connect Claude</Link>,{" "}
            <Link href={helpPath("klaviyo", "connect")}>Connecting Klaviyo</Link>.
          </li>
        </ul>
        <Callout>
          <p>
            These steps follow{" "}
            <a href={SHOPIFY.docs.connector} target="_blank" rel="noopener">
              Shopify&apos;s own guide
            </a>
            , checked in {SHOPIFY.checked}. Shopify&apos;s page has the latest.
          </p>
        </Callout>
      </HelpSection>

      <HelpSection page={P} id="set-up">
        <p>With Walkoff and Shopify connected, ask Claude:</p>
        <Ask>Set up Walkoff from our Shopify store.</Ask>
        <p>
          Or pick Walkoff&apos;s prompt, <strong>Set up from Shopify</strong>, if your Claude app
          shows connector prompts. Claude then does three things:
        </p>
        <ol>
          <li>Walkoff reads your products from your store.</li>
          <li>Claude runs two reports in Shopify&apos;s analytics: customers by postal code, and by state or province.</li>
          <li>Walkoff turns those counts into your fan map, and Claude shows you your standout teams.</li>
        </ol>
        <ExampleSession {...SESSIONS.setup} />
        <p>
          It takes a few minutes, mostly while Claude passes the counts along. Run it again
          whenever you like:
        </p>
        <Ask>Update our catalog from the store.</Ask>
        <Ask>Refresh our fan map from Shopify.</Ask>
      </HelpSection>

      <HelpSection page={P} id="products">
        <p>
          Walkoff reads your store&apos;s public product feed: what your store already shows
          shoppers. That&apos;s titles, types, tags, descriptions, prices, colorways, SKUs and
          photos. No customer data.
        </p>
        <ul>
          <li>Colorways come from your variants&apos; color option, with their SKUs and photos.</li>
          <li>
            New products are added and the rest updated. Nothing is removed. One import reads up
            to {fmt(SHOPIFY.maxProducts)} products.
          </li>
          <li>Claude tags them for teams and colors within minutes.</li>
          <li>Products that aren&apos;t on your online store aren&apos;t in the feed.</li>
        </ul>
        <p>
          More on colorways: <Link href={helpPath("uploads", "colorways")}>Products and colorways</Link>
        </p>
      </HelpSection>

      <HelpSection page={P} id="customers">
        <p>
          Claude runs these two queries with the Shopify connector, exactly as written. Both count
          customers with a US, Canadian or UK shipping address in the last year.
        </p>
        <p>
          <strong>Customers by postal code</strong>, for your {fmt(SHOPIFY.postalRows)} biggest:
        </p>
        <CopyLine>{SHOPIFY.queries.postalCodes}</CopyLine>
        <p>
          <strong>Customers by state or province:</strong>
        </p>
        <CopyLine>{SHOPIFY.queries.regions}</CopyLine>
        <ul>
          <li>
            Walkoff cuts each postal code to its area, like 921 for San Diego, M5V in Toronto or
            N17 in London, and keeps the count.
          </li>
          <li>
            Customers outside your biggest postal codes are spread over their state or province
            by population. In the UK, over the whole country.
          </li>
          <li>
            So your map is exact where most of your customers are, and an estimate elsewhere.
            Claude tells you how many were placed by their own postal code.
          </li>
          <li>
            Each import replaces your counts, and your map is made again.
          </li>
        </ul>
        <p>
          Maps set up this way show where your customers are. What each territory buys more of
          needs an orders upload. <Link href={helpPath("fan-map", "buys")}>What each territory buys</Link>
        </p>
        <Callout>
          <p>
            The queries use{" "}
            <a href={SHOPIFY.docs.salesSchema} target="_blank" rel="noopener">
              Shopify&apos;s sales data
            </a>
            , with the connector&apos;s {SHOPIFY.analyticsTool} tool, which only reads.
          </p>
        </Callout>
      </HelpSection>

      <HelpSection page={P} id="privacy">
        <ul>
          <li>
            <strong>Counts, not customer lists.</strong> Claude asks Shopify for counts only: a
            country, a postal code or state, and a number of customers. Never names, emails,
            phone numbers or street addresses.
          </li>
          <li>
            <strong>Areas, not postal codes.</strong> Walkoff cuts each postal code to its area as
            it arrives, and keeps only the area and the count. Full postal codes aren&apos;t
            stored.
          </li>
          <li>
            <strong>More than counts is refused.</strong> Rows that look like they hold anything
            else, like an email address, are turned away, and nothing is saved.
          </li>
          <li>
            <strong>On your permissions.</strong> Claude reads the counts with your Shopify
            connector, signed in as you, and sees them while it works.
          </li>
          <li>
            <strong>Products come from your public store.</strong> Walkoff reads only what
            shoppers can see.
          </li>
        </ul>
        <p>
          More: <Link href={helpPath("data-and-safety", "counts")}>Data and safety</Link>
        </p>
      </HelpSection>

      <HelpSection page={P} id="not-shopify">
        <p>
          Not on Shopify, or rather not connect it in Claude? Use your private upload page. The
          link is in your welcome email. It reads your exports in your browser and sends only
          counts by area. <Link href={helpPath("uploads")}>Uploading files</Link>
        </p>
      </HelpSection>

      <HelpSection page={P} id="trouble">
        <HelpFaq
          items={[
            {
              id: "no-feed",
              q: "Walkoff says our store doesn't have a Shopify product feed.",
              a: (
                <p>
                  Some Shopify stores don&apos;t serve one, like a custom storefront built on
                  Hydrogen. Upload a product export on your upload page instead.
                </p>
              ),
            },
            {
              id: "password",
              q: "It says our store is password protected.",
              a: <p>Walkoff reads only what your store shows shoppers. Ask again once it&apos;s open, or upload a product export now.</p>,
            },
            {
              id: "analytics",
              q: "Claude can't run the queries.",
              a: (
                <p>
                  Check the Shopify account you connected can see your store&apos;s reports. If
                  Shopify rejects a query, Claude fixes only its wording and runs it again, with
                  the same columns.
                </p>
              ),
            },
            {
              id: "part-of-catalog",
              q: "Only part of our catalog came in.",
              a: (
                <p>
                  One import reads up to {fmt(SHOPIFY.maxProducts)} products, and stops early if
                  your store is slow. What was read is saved. Ask again, or upload a product export
                  for the rest.
                </p>
              ),
            },
            {
              id: "spread",
              q: "Claude says many of our customers were spread by population.",
              a: (
                <p>
                  That&apos;s normal for a brand whose customers are spread over many postal
                  codes. Your standouts still come from where your customers really are.
                </p>
              ),
            },
          ]}
        />
        <p>
          The exact messages and what to do: <Link href={helpPath("troubleshooting", "setup")}>Setting up from Shopify</Link>
        </p>
      </HelpSection>
    </HelpPage>
  );
}
