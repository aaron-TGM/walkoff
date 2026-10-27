import Image from "next/image";
import Link from "next/link";
import { BrandSpan } from "@/components/BrandSpan";
import { helpPath } from "@/lib/help/pages";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-w">
        <div className="footer-grid">
          <div>
            <div className="footer-mark">
              <Image
                src="/walkoff_logo_white_v2.png"
                alt="WALKOFF."
                width={1539}
                height={367}
                className="footer-logo"
              />
            </div>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Product</div>
            <ul>
              <li>
                <Link href="/#how">How it works</Link>
              </li>
              <li>
                <Link href="/#moments">Moments</Link>
              </li>
              <li>
                <Link href="/#mcp">Works in Claude</Link>
              </li>
              <li>
                <Link href="/#pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/#faq">FAQ</Link>
              </li>
              <li>
                <Link href="/p/demo">Sample campaign</Link>
              </li>
              <li>
                <Link href="/upload/demo">Sample fan map</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Help</div>
            <ul>
              <li>
                <Link href={helpPath("onboarding")}>Getting started</Link>
              </li>
              <li>
                <Link href={helpPath("help")}>Help center</Link>
              </li>
              <li>
                <Link href={helpPath("connect")}>Connect Claude</Link>
              </li>
              <li>
                <Link href={helpPath("tools")}>Tools and asks</Link>
              </li>
              <li>
                <Link href={helpPath("troubleshooting")}>Troubleshooting</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <div className="footer-col-title">Company</div>
            <ul>
              <li>
                <Link href="/status">Status</Link>
              </li>
              <li>
                <Link href="/privacy#security">Security</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <a href="mailto:hello@walkoff.io">Contact</a>
              </li>
            </ul>
          </div>
        </div>
        <p className="footer-disclaimer">
          Walkoff is not affiliated with, endorsed by or sponsored by any league,
          team or player. Team and league names describe real-world events only.
        </p>
        <div className="footer-bottom">
          <span>
            © 2026 <BrandSpan /> · A Tuff Ghost Media product
          </span>
          <span>San Clemente, California</span>
          <span>walkoff.io</span>
        </div>
      </div>
    </footer>
  );
}
