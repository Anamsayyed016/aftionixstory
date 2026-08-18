"use client";

import { useRef, type MouseEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { PROJECTS } from "@/constants/portfolio/projects";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/portfolio/variants";

function CaseCard({
  project,
  index,
}: {
  project: (typeof PROJECTS)[number];
  index: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${y * -6}deg) rotateY(${x * 8}deg) translateZ(8px)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "rotateX(0deg) rotateY(0deg) translateZ(0)";
  };

  const inner = (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="pf-mono text-[0.68rem] uppercase tracking-[0.18em] text-[var(--pf-ink-faint)]">
          {String(index + 1).padStart(2, "0")} · {project.year}
        </p>
        <ArrowUpRight className="size-4 text-[var(--pf-accent)]" />
      </div>
      <h3 className="pf-display mt-6 text-3xl font-semibold sm:text-4xl">{project.title}</h3>
      <p className="mt-2 text-sm text-[var(--pf-ink-faint)]">{project.role}</p>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--pf-ink-dim)] sm:text-base">
        {project.summary}
      </p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-[var(--pf-line)] px-3 py-1 text-xs text-[var(--pf-ink-dim)]"
          >
            {tag}
          </li>
        ))}
      </ul>
    </>
  );

  const className =
    "pf-panel block p-7 transition-[transform,border-color] duration-300 sm:p-9 hover:border-[color-mix(in_srgb,var(--pf-accent)_35%,var(--pf-line))]";

  if (project.href.startsWith("#")) {
    return (
      <a
        ref={ref}
        href={project.href}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={className}
        style={{ transformStyle: "preserve-3d" }}
      >
        {inner}
        <span className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--pf-accent)]">
          {project.hrefLabel}
        </span>
      </a>
    );
  }

  return (
    <Link
      ref={ref}
      href={project.href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ transformStyle: "preserve-3d" }}
    >
      {inner}
      <span className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--pf-accent)]">
        {project.hrefLabel}
      </span>
    </Link>
  );
}

export function Projects() {
  return (
    <section id="work" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Selected work
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="pf-display mt-4 max-w-xl text-4xl font-semibold sm:text-5xl"
          >
            Products and systems with a real surface area.
          </motion.h2>
        </motion.div>

        <div className="mt-14 grid gap-5" style={{ perspective: "1200px" }}>
          {PROJECTS.map((project, index) => (
            <CaseCard key={project.id} project={project} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
