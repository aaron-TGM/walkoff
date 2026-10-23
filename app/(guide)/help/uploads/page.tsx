import Link from "next/link";
import { HelpPage, HelpSection } from "@/components/help/HelpPage";
import { ExportGuides } from "@/components/upload/ExportGuides";
import { DEMO_BRAND } from "@/lib/affinity/demo";
import { FORMAT_LABEL, formatKind, type ImportFormat } from "@/lib/affinity/imports";
import { helpMetadata, helpPath } from "@/lib/help/pages";

export const metadata = helpMetadata("uploads");

const P = "uploads";

const FILES: { format: ImportFormat; gives: string }[] = [
  { format: "shopify_orders", gives: "Customers by area, and what each area buys. The best file." },
  { format: "shopify_customers", gives: "Customers by area." },
  { format: "klaviyo_profiles", gives: "Customers by area. Include Zip Code and Country in the export." },
  { format: "counts_csv", gives: "postal_code, country (US, CA or GB) and customers columns. Revenue is optional." },
  { format: "shopify_products", gives: "Your products and every colorway, with SKUs and photos." },
  { format: "catalog_csv", gives: "title, product type and tags columns." },
];

const step = (f: ImportFormat) => (formatKind(f) === "customers" ? 1 : 2);

export default function UploadsPage() {
  return (
    <HelpPage slug={P}>
      <HelpSection page={P} id="what-leaves">
        <p>
          Your browser reads each file on your computer. For customers and orders, it keeps only
          counts by postal area, and that&apos;s all it sends:
        </p>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Postal area</th>
                <th>Customers</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>US</td>
                <td>921</td>
                <td>212</td>
                <td>340</td>
              </tr>
              <tr>
                <td>CA</td>
                <td>M5V</td>
                <td>96</td>
                <td>121</td>
              </tr>
              <tr>
                <td>GB</td>
                <td>N17</td>
                <td>44</td>
                <td>52</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li>
            A US area is the first 3 digits of the ZIP code: 921 is around San Diego. A Canadian
            area is the first 3 characters of the postal code, like M5V. A UK area is the postcode
            district, like N17.
          </li>
          <li>Names, emails, street addresses and full postal codes stay on your computer.</li>
          <li>Walkoff checks again when the counts arrive, and refuses anything finer than an area.</li>
        </ul>
        <p>
          Product files hold product details only: titles, types, tags, short descriptions,
          prices, colorways, SKUs and photo links. No customer data.
        </p>
      </HelpSection>

      <HelpSection page={P} id="files">
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Step</th>
                <th>What it gives Walkoff</th>
              </tr>
            </thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.format}>
                  <td>{FORMAT_LABEL[f.format]}</td>
                  <td>{step(f.format)}</td>
                  <td>{f.gives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Step 1 is customers or orders, for your fan map. Step 2 is products, for picks in each
          team&apos;s colors. The upload page tells you if a file is in the wrong step.
        </p>
      </HelpSection>

      <HelpSection page={P} id="export">
        <p>The same guides are on your upload page.</p>
        <ExportGuides open />
      </HelpSection>

      <HelpSection page={P} id="colorways">
        <p>
          Walkoff reads every colorway from your product export: the color option of your
          variants, with their SKUs and photos. That&apos;s how a win features your own products
          in the team&apos;s colors, with no logo or license.
        </p>
        <p>
          Common color names like &ldquo;Azure Heather&rdquo; or &ldquo;Navy/Gold&rdquo; get
          their colors right away. Names Walkoff can&apos;t read yet, like &ldquo;Dune&rdquo; or
          &ldquo;Cove&rdquo;, get named when Claude reads your catalog, a few minutes after you
          upload it.
        </p>
        <p>
          You don&apos;t need team gear. If you do make products for a team, Claude finds them,
          and they&apos;re featured first.
        </p>
      </HelpSection>

      <HelpSection page={P} id="updating">
        <ul>
          <li>
            <strong>Customers or orders.</strong> Each upload replaces your counts, and your map
            is made again. An orders export also replaces what each area buys.
          </li>
          <li>
            <strong>Products.</strong> Each upload adds new products and updates the ones
            you&apos;ve uploaded before. Nothing is removed. Claude&apos;s tags are kept, and it
            reads new products, and ones whose title or description changed, within minutes.
          </li>
        </ul>
        <p>
          Upload again whenever your customers or catalog change. Lost the link? It&apos;s in
          your welcome email, and your Walkoff contact can send it again.
        </p>
      </HelpSection>

      <HelpSection page={P} id="demo">
        <p>
          Want to see it before you upload anything? <Link href="/upload/demo">The demo</Link>{" "}
          reads your own file in your browser and shows your map. Nothing is uploaded.
        </p>
        <p>
          It opens with a sample brand, {DEMO_BRAND}, so there&apos;s something to look at. Its
          map is on <Link href={helpPath("fan-map", "example")}>Your fan map</Link>.
        </p>
      </HelpSection>
    </HelpPage>
  );
}
