"use client";

import { useState } from "react";
import type { Trigger } from "@/lib/triggers";

interface Props {
  label: string;
  items: Trigger[];
}

export function TriggerCategory({ label, items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="trigger-cat">
      <button
        className="trigger-cat-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="trigger-cat-label-text">— {label}</span>
        <span className="trigger-cat-meta">
          <span className="trigger-cat-count">({items.length})</span>
          <span className="trigger-cat-chevron" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {open && (
        <div className="trigger-grid-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="border border-rule bg-paper p-[1.1rem]"
            >
              <div className="mb-1 font-display text-[0.9rem] font-bold uppercase tracking-[-0.005em]">
                {t.name}
              </div>
              <div className="mb-2.5 font-mono text-[0.58rem] tracking-[0.05em] text-red">
                {t.id}
              </div>
              <p className="text-[0.8rem] leading-[1.45] text-inkMuted">
                {t.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
