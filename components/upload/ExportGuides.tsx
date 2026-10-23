// Step-by-step export instructions for the files the upload page reads.
import { GUIDES } from "@/lib/affinity/guides";

export function ExportGuides({ open = false }: { open?: boolean }) {
  return (
    <div className="guides">
      {GUIDES.map((g) => (
        <details key={g.title} className="guide" open={open}>
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
