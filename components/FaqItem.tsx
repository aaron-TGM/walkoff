"use client";

import { useEffect, useRef, useState } from "react";

interface FaqItemProps {
  num: string;
  question: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function FaqItem({ num, question, children, defaultOpen = false }: FaqItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);

  // On mount: close all on mobile (≤860px)
  useEffect(() => {
    if (window.innerWidth <= 860) {
      setOpen(false);
    }
  }, []);

  return (
    <div className="faq-item">
      <button
        className="faq-q"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <span className="faq-q-right">
          <span className="faq-q-num">{num}</span>
          <span className="faq-toggle" aria-hidden>
            <span className="faq-toggle-h" />
            <span className={`faq-toggle-v${open ? " faq-toggle-v-open" : ""}`} />
          </span>
        </span>
      </button>
      <div
        ref={bodyRef}
        className="faq-body"
        style={{ display: open ? "block" : "none" }}
      >
        <p className="faq-a">{children}</p>
      </div>
    </div>
  );
}
