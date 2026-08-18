import { PERSON } from "@/constants/portfolio/content";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--portfolio-line)] py-10">
      <div className="pf-wrap flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="pf-display text-sm font-semibold uppercase tracking-[0.16em]">
            {PERSON.name}
          </p>
          <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--portfolio-faint)]">
            {PERSON.role}
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-5">
          <a href="#about" className="pf-link font-mono text-[0.65rem] uppercase tracking-[0.16em]">
            About
          </a>
          <a href="#work" className="pf-link font-mono text-[0.65rem] uppercase tracking-[0.16em]">
            Work
          </a>
          <a href="#contact" className="pf-link font-mono text-[0.65rem] uppercase tracking-[0.16em]">
            Contact
          </a>
        </nav>
        <p className="text-xs text-[var(--portfolio-faint)]">
          © 2026 {PERSON.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
