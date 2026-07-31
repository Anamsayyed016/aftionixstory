import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SITE } from "@/lib/constants";

const FOOTER_LINKS = {
  Product: [
    { label: "Story Studio", href: "#story-studio" },
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
  ],
  "Coming soon": [
    { label: "Business Directory", href: "#coming-soon" },
    { label: "Jobs", href: "#coming-soon" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Content Guidelines", href: "#" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-charcoal">
      <Container className="py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/aftionix-logo.jpg"
                alt="AFTIONIX"
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-border"
              />
              <span className="font-display text-lg font-semibold text-ink">
                {SITE.name}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-ink-faint">
              {SITE.description}
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-faint">
                {heading}
              </h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-ink-dim transition-colors hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-ink-faint sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p className="font-mono">{SITE.tagline}</p>
        </div>
      </Container>
    </footer>
  );
}
