// Step-by-step export instructions for the files the upload page reads,
// shared by the upload page and the help center. Each guide names the format
// its file comes out as, so its "drop it in step" matches formatKind.
import type { ImportFormat } from "./imports";

export interface ExportGuide {
  title: string;
  format: ImportFormat;
  best?: string;
  steps: string[];
  note?: string;
}

export const GUIDES: ExportGuide[] = [
  {
    title: "Shopify: orders (best)",
    format: "shopify_orders",
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
    format: "shopify_customers",
    steps: [
      "In Shopify admin, go to Customers.",
      "Click Export, then choose All customers.",
      "Pick CSV for Excel, Numbers, or other spreadsheet programs.",
      "Click Export customers and drop the file in step 1.",
    ],
  },
  {
    title: "Shopify: products",
    format: "shopify_products",
    steps: [
      "In Shopify admin, go to Products.",
      "Click Export, then choose All products.",
      "Pick CSV for Excel, Numbers, or other spreadsheet programs.",
      "Click Export products and drop the file in step 2.",
    ],
  },
  {
    title: "Klaviyo: profiles",
    format: "klaviyo_profiles",
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
    format: "counts_csv",
    steps: [
      "Make a spreadsheet with one row per postal code.",
      "Columns: postal_code, country (US, CA or GB) and customers. Revenue is optional.",
      "Save it as CSV and drop it in step 1.",
    ],
    note: "For products, a spreadsheet with title, product type and tags columns works in step 2.",
  },
];
