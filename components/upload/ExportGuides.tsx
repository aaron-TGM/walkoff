// Step-by-step export instructions for the files the upload page reads.
const GUIDES: { title: string; best?: string; steps: string[]; note?: string }[] = [
  {
    title: "Shopify: orders (best)",
    best: "Gives us customers and what they buy, so your map can name products.",
    steps: [
      "In Shopify admin, go to Orders.",
      "Click Export.",
      "Choose a date range. The last 12 months is plenty.",
      "Pick Plain CSV file, then Export orders.",
      "Shopify downloads the file, or emails it for big stores. Drop it in step 1.",
    ],
  },
  {
    title: "Shopify: customers",
    steps: [
      "In Shopify admin, go to Customers.",
      "Click Export, then choose All customers.",
      "Pick CSV for Excel, Numbers, or other spreadsheet programs.",
      "Click Export customers and drop the file in step 1.",
    ],
  },
  {
    title: "Shopify: products",
    steps: [
      "In Shopify admin, go to Products.",
      "Click Export, then choose All products.",
      "Pick CSV for Excel, Numbers, or other spreadsheet programs.",
      "Click Export products and drop the file in step 2.",
    ],
  },
  {
    title: "Klaviyo: profiles",
    steps: [
      "In Klaviyo, open Audience, then Lists & segments.",
      "Open the list or segment you market to, for example everyone who has bought.",
      "Use the Manage menu to export it to CSV.",
      "Include Zip Code and Country in the export, then start it.",
      "Klaviyo emails a download link. Drop the file in step 1.",
    ],
  },
  {
    title: "Any other platform",
    steps: [
      "Make a spreadsheet with one row per postal code.",
      "Columns: postal_code, country (US, CA or GB) and customers. Revenue is optional.",
      "Save it as CSV and drop it in step 1.",
    ],
    note: "For products, a spreadsheet with title, product type and tags columns works in step 2.",
  },
];

export function ExportGuides() {
  return (
    <div className="guides">
      {GUIDES.map((g) => (
        <details key={g.title} className="guide">
          <summary className="guide-title">{g.title}</summary>
          {g.best ? <p className="guide-best">{g.best}</p> : null}
          <ol className="guide-steps">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {g.note ? <p className="guide-note">{g.note}</p> : null}
        </details>
      ))}
    </div>
  );
}
