import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#moments", label: "Moments" },
  { href: "/#mcp", label: "MCP" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/status", label: "Status" },
];

export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="nav-inner">
        <Link href="/" className="nav-mark">
          <Image
            src="/walkoff_logov3.png"
            alt="WALKOFF."
            width={1539}
            height={367}
            className="nav-logo"
            priority
          />
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/#form" className="nav-cta">
          <span>Get Early Access</span>
        </Link>
      </div>
    </nav>
  );
}
