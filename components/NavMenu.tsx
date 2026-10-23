"use client";

import Link from "next/link";
import { useRef } from "react";

/** The nav's links below 1024px, behind a Menu button. Closes when a link
 *  is picked, since the page around it may not change (links to sections). */
export function NavMenu({ links }: { links: { href: string; label: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute("open");
  return (
    <details ref={ref} className="nav-menu">
      <summary className="nav-menu-button">
        <span className="nav-menu-icon" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        Menu
      </summary>
      <div className="nav-menu-panel">
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={close}>
            {l.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
