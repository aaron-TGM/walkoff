"use client";

import { useState } from "react";
import type { Trigger, TriggerCategory as TCat } from "@/lib/triggers";

const ICON_COLORS: Record<TCat, string> = {
  before: "text-red",
  during: "text-mustard",
  after: "text-red",
  season: "text-grass",
};

const ICONS: Record<TCat, React.ReactNode> = {
  before: (
    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="8" width="30" height="26" rx="2" />
      <path d="M5 16 H35" />
      <path d="M13 4 V12 M27 4 V12" />
      <path d="M12 23 H14 M19 23 H21 M26 23 H28" />
      <path d="M12 29 H14 M19 29 H21" />
    </svg>
  ),
  during: (
    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 4 L10 22 H19 L17 36 L30 17 H21 Z" />
    </svg>
  ),
  after: (
    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 32 C18 30 6 23 6 14 C6 9.5 9.5 6 14 6 C17 6 19.5 8 20 9 C20.5 8 23 6 26 6 C30.5 6 34 9.5 34 14 C34 23 22 30 20 32 Z" />
    </svg>
  ),
  season: (
    <svg width="18" height="18" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 5 H27 V17 C27 23 23 26 20 26 C17 26 13 23 13 17 Z" />
      <path d="M7 7 H13 C13 15 8.5 17 7 13 Z" />
      <path d="M27 7 H33 C33 17 27.5 15 27 7 Z" />
      <path d="M17 26 V31 M23 26 V31" />
      <path d="M13 31 H27" />
    </svg>
  ),
};

interface Props {
  categoryId: TCat;
  label: string;
  items: Trigger[];
}

export function TriggerCategory({ categoryId, label, items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="trigger-cat">
      <button
        className="trigger-cat-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="trigger-cat-label-text">
          <span className={`trigger-cat-icon ${ICON_COLORS[categoryId]}`}>{ICONS[categoryId]}</span>
          {label}
        </span>
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
