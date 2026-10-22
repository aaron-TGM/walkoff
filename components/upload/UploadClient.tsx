"use client";

import Papa from "papaparse";
import { useRef, useState } from "react";
import { computeAffinity, type AffinityReport, type TaggedProduct } from "@/lib/affinity/compute";
import { demoData } from "@/lib/affinity/demo";
import {
  aggregateCustomers,
  detectFormat,
  FORMAT_LABEL,
  formatKind,
  parseCatalog,
  type CatalogItem,
  type CustomerImport,
  type ImportFormat,
  type Row,
} from "@/lib/affinity/imports";
import { tagProduct } from "@/lib/affinity/tagging";
import { AffinityReportView } from "./AffinityReportView";
import { ExportGuides } from "./ExportGuides";

type Status = "idle" | "reading" | "ready" | "uploading" | "done";

interface Props {
  token: string;
  brandName: string;
  initialReport: AffinityReport | null;
  initialCatalog: { products: number; tagged: number };
  /** Demo: files are read and mapped in the browser, nothing is uploaded. */
  demo?: boolean;
}

function readCsv(file: File): Promise<{ fields: string[]; rows: Row[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => resolve({ fields: res.meta.fields ?? [], rows: res.data }),
      error: (err) => reject(err),
    });
  });
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Upload failed. Please try again.");
  return data;
}

function DropZone({
  label,
  hint,
  busy,
  onFile,
}: {
  label: string;
  hint: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <label
      className={`dropzone${over ? " dropzone-over" : ""}${busy ? " dropzone-busy" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="dropzone-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          if (input.current) input.current.value = "";
        }}
      />
      <span className="dropzone-label">{busy ? "Reading your file…" : label}</span>
      <span className="dropzone-hint">{hint}</span>
    </label>
  );
}

export function UploadClient({ token, brandName, initialReport, initialCatalog, demo = false }: Props) {
  const [report, setReport] = useState<AffinityReport | null>(initialReport);
  const [customers, setCustomers] = useState<{ status: Status; file?: string; data?: CustomerImport; error?: string }>({
    status: "idle",
  });
  const [catalog, setCatalog] = useState<{
    status: Status;
    file?: string;
    format?: ImportFormat;
    items?: CatalogItem[];
    error?: string;
  }>({ status: "idle" });
  const [catalogStats, setCatalogStats] = useState(initialCatalog);
  const [demoTags, setDemoTags] = useState<TaggedProduct[] | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const showReport = (next: AffinityReport | null) => {
    setReport(next);
    requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  async function readFile(file: File, want: "customers" | "catalog") {
    const set = want === "customers" ? setCustomers : setCatalog;
    set({ status: "reading", file: file.name });
    try {
      const { fields, rows } = await readCsv(file);
      const format: ImportFormat | null = detectFormat(fields);
      if (!format) {
        set({ status: "idle", error: "We couldn't tell what this file is. The export guides below show the files we read." });
        return;
      }
      if (formatKind(format) !== want) {
        set({
          status: "idle",
          error:
            want === "customers"
              ? `That's a ${FORMAT_LABEL[format].toLowerCase()}. Drop it in step 2.`
              : `That's a ${FORMAT_LABEL[format].toLowerCase()}. Drop it in step 1.`,
        });
        return;
      }
      if (want === "customers") {
        const data = aggregateCustomers(format, rows);
        if (!data.areas.length) {
          setCustomers({ status: "idle", error: "No rows had a US, Canadian or UK postal code we could read." });
          return;
        }
        setCustomers({ status: "ready", file: file.name, data });
      } else {
        const items = parseCatalog(format, rows);
        if (!items.length) {
          setCatalog({ status: "idle", error: "No products with a title in this file." });
          return;
        }
        setCatalog({ status: "ready", file: file.name, format, items });
      }
    } catch {
      set({ status: "idle", error: "We couldn't read that file. Is it a CSV?" });
    }
  }

  async function uploadCustomers() {
    const data = customers.data;
    if (!data) return;
    setCustomers((s) => ({ ...s, status: "uploading", error: undefined }));
    try {
      if (demo) {
        const seed = demoData();
        showReport(computeAffinity(data.areas, { products: data.products, catalog: demoTags ?? seed.catalog }));
      } else {
        const res = await post<{ report: AffinityReport | null }>(`/api/upload/${token}/customers`, data);
        showReport(res.report);
      }
      setCustomers((s) => ({ ...s, status: "done" }));
    } catch (e) {
      setCustomers((s) => ({ ...s, status: "ready", error: (e as Error).message }));
    }
  }

  async function uploadCatalog() {
    const { items, format } = catalog;
    if (!items || !format) return;
    setCatalog((s) => ({ ...s, status: "uploading", error: undefined }));
    try {
      if (demo) {
        const tags = items.map((i) => ({ title: i.title, teams: tagProduct(i).teams })).filter((t) => t.teams.length);
        setDemoTags(tags);
        setCatalogStats({ products: items.length, tagged: tags.length });
        const seed = demoData();
        const areas = customers.data?.areas ?? seed.areas;
        const products = customers.data ? customers.data.products : seed.products;
        showReport(computeAffinity(areas, { products, catalog: tags }));
      } else {
        const res = await post<{ products: number; tagged: number; report: AffinityReport | null }>(
          `/api/upload/${token}/catalog`,
          { format, items },
        );
        setCatalogStats({ products: res.products, tagged: res.tagged });
        if (res.report) showReport(res.report);
      }
      setCatalog((s) => ({ ...s, status: "done" }));
    } catch (e) {
      setCatalog((s) => ({ ...s, status: "ready", error: (e as Error).message }));
    }
  }

  const c = customers.data;
  const placed = c ? c.areas.reduce((s, a) => s + a.customers, 0) : 0;

  return (
    <div className="container-w upload">
      <div className="block-num">
        <span className="eyebrow-dot" aria-hidden />
        {demo ? "Demo" : "Your affinity map"}
      </div>
      <h1 className="upload-h1">
        {brandName}
        <em>{demo ? "Try it with your own file" : "Find your fans"}</em>
      </h1>
      <p className="upload-lead">
        Drop in an export from Shopify or Klaviyo. Your browser reads it and keeps only
        counts by postal area. Names, emails, street addresses and full postal codes never
        leave your computer.
        {demo ? " This demo doesn't upload anything at all." : ""}
      </p>

      <div className="upload-steps">
        <section className="upload-step">
          <div className="upload-step-num">Step 1</div>
          <h2 className="upload-step-title">Customers or orders</h2>
          <p className="upload-step-body">
            A Shopify order or customer export, a Klaviyo profile export, or a spreadsheet
            of counts. Orders work best: they also show what each territory buys.
          </p>
          <DropZone
            label="Drop your export here, or click to choose"
            hint="CSV · read on your computer"
            busy={customers.status === "reading"}
            onFile={(f) => readFile(f, "customers")}
          />
          {customers.error ? <p className="form-error">{customers.error}</p> : null}
          {c && customers.status !== "idle" ? (
            <div className="preview">
              <div className="preview-head">
                <span className="preview-format">{FORMAT_LABEL[c.format]}</span>
                <span className="preview-file">{customers.file}</span>
              </div>
              <p className="preview-line">
                {fmt(c.rows)} rows read &middot; <strong>{fmt(placed)} customers</strong> in{" "}
                {fmt(c.areas.length)} postal areas
                {c.skipped ? ` · ${fmt(c.skipped)} without a usable postal code` : ""}
                {c.products.length ? ` · orders for ${fmt(new Set(c.products.map((p) => p.product)).size)} products` : ""}
              </p>
              <div className="preview-label">Exactly what {demo ? "would leave" : "leaves"} your computer</div>
              <table className="report-table preview-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Postal area</th>
                    <th>Customers</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {c.areas.slice(0, 6).map((a) => (
                    <tr key={`${a.country}${a.area}`}>
                      <td>{a.country}</td>
                      <td>{a.area}</td>
                      <td>{fmt(a.customers)}</td>
                      <td>{fmt(a.orders ?? 0)}</td>
                      <td>${fmt(a.revenue ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.areas.length > 6 ? <p className="preview-more">…and {fmt(c.areas.length - 6)} more rows like these.</p> : null}
              <button
                type="button"
                className="form-submit"
                disabled={customers.status === "uploading" || customers.status === "done"}
                onClick={uploadCustomers}
              >
                <span>
                  {customers.status === "uploading"
                    ? "Mapping…"
                    : customers.status === "done"
                      ? "Mapped ✓"
                      : demo
                        ? "Map my customers →"
                        : "Upload counts and map my customers →"}
                </span>
              </button>
            </div>
          ) : null}
        </section>

        <section className="upload-step">
          <div className="upload-step-num">Step 2 &middot; optional</div>
          <h2 className="upload-step-title">Products</h2>
          <p className="upload-step-body">
            Your Shopify product export, or a spreadsheet of products. We tag teams, colors and
            uses so moments can name the right product.
          </p>
          <DropZone
            label="Drop your product export here"
            hint="CSV · product details only"
            busy={catalog.status === "reading"}
            onFile={(f) => readFile(f, "catalog")}
          />
          {catalog.error ? <p className="form-error">{catalog.error}</p> : null}
          {catalog.items && catalog.status !== "idle" ? (
            <div className="preview">
              <p className="preview-line">
                <strong>{fmt(catalog.items.length)} products</strong> found, for example{" "}
                {catalog.items
                  .slice(0, 3)
                  .map((i) => i.title)
                  .join(", ")}
                .
              </p>
              <button
                type="button"
                className="form-submit"
                disabled={catalog.status === "uploading" || catalog.status === "done"}
                onClick={uploadCatalog}
              >
                <span>
                  {catalog.status === "uploading" ? "Tagging…" : catalog.status === "done" ? "Tagged ✓" : "Tag my products →"}
                </span>
              </button>
            </div>
          ) : catalogStats.products ? (
            <p className="preview-line">
              {fmt(catalogStats.products)} products on file, {fmt(catalogStats.tagged)} tagged to a team.
            </p>
          ) : null}
        </section>
      </div>

      <div ref={reportRef} className="upload-report">
        <h2 className="section-title section-title-stack">
          Your territories
          <em>{report ? "who your customers cheer for" : "appear here"}</em>
        </h2>
        {report ? (
          <AffinityReportView report={report} />
        ) : (
          <p className="report-empty">Upload customers or orders in step 1 to see your map.</p>
        )}
      </div>

      <div className="upload-guides">
        <h2 className="upload-step-title">How to export your files</h2>
        <ExportGuides />
      </div>
    </div>
  );
}
