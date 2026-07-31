import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/company/ui/Container";
import { SITE, FOOTER_LINKS } from "@/constants/company/site";
import { GithubIcon, LinkedinIcon, InstagramIcon } from "@/components/company/ui/SocialIcons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border bg-canvas-soft">
      <Container className="py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/aftionix-logo.jpg"
                alt="AFTIONIX"
                className="size-8 shrink-0 rounded-[var(--radius-sm)] object-cover ring-1 ring-border"
              />
              AFTIONIX
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              {SITE.tagline} Founded by {SITE.founder} — {SITE.experience} building
              custom software, SaaS, and AI products.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: LinkedinIcon, href: SITE.socials.linkedin, label: "LinkedIn" },
                { icon: GithubIcon, href: SITE.socials.github, label: "GitHub" },
                { icon: InstagramIcon, href: SITE.socials.instagram, label: "Instagram" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-full border border-border-strong text-ink-soft transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Services
            </h3>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.services.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
              Stay in the loop
            </h3>
            <p className="mt-4 text-sm text-ink-soft">
              Occasional notes on new work, AI tooling, and what we&apos;re building next.
            </p>
            <form className="mt-4 flex items-center gap-2">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                placeholder="you@company.com"
                className="h-11 w-full rounded-[var(--radius-md)] border border-border-strong bg-white px-4 text-sm text-ink placeholder:text-ink-faint"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--co-primary),var(--co-accent))] text-white transition-transform hover:-translate-y-0.5"
              >
                <ArrowRight className="size-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-xs text-ink-faint sm:flex-row sm:items-center">
          <p>
            © {year} AFTIONIX. All rights reserved. Founded by {SITE.founder}.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-ink-soft">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ink-soft">
              Terms of Service
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
