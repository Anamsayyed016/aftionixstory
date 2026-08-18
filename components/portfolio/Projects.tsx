"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { PROJECTS, type Project } from "@/constants/portfolio/projects";
import { fadeUp, revealViewport, scaleIn } from "@/animations/portfolio/variants";
import { cn } from "@/lib/utils";

function visualClass(visual: Project["visual"]) {
  switch (visual) {
    case "constellation":
      return "pf-visual-constellation";
    case "memory":
      return "pf-visual-memory";
    case "grid":
      return "pf-visual-grid";
    case "weave":
      return "pf-visual-weave";
    default:
      return "pf-visual-grid";
  }
}

function ProjectPanel({
  project,
  size,
}: {
  project: Project;
  size: "large" | "small";
}) {
  const visual = (
    <div className={cn("pf-visual", size === "large" ? "min-h-[18rem] lg:min-h-full" : "min-h-[13rem]")} aria-hidden>
      <div className={cn("pf-visual-media", visualClass(project.visual))} />
    </div>
  );

  const copy = (
    <div className={cn("flex flex-col", size === "large" ? "p-7 sm:p-10" : "p-6 sm:p-7")}>
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[var(--portfolio-faint)]">
        {project.index}
      </p>
      <h3
        className={cn(
          "pf-display mt-4 font-semibold tracking-tight",
          size === "large" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        )}
      >
        {project.title}
      </h3>
      <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[var(--portfolio-accent)]">
        {project.category}
      </p>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--portfolio-muted)] sm:text-[0.95rem]">
        {project.description}
      </p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-[var(--portfolio-line)] px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[var(--portfolio-muted)]"
          >
            {tag}
          </li>
        ))}
      </ul>
      {project.href ? (
        <span className="mt-8 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-[var(--portfolio-text)]">
          View project
          <span className="pf-arrow" aria-hidden>
            →
          </span>
        </span>
      ) : null}
    </div>
  );

  const className = cn(
    "pf-panel pf-project",
    size === "large" && "lg:grid-cols-[1.05fr_0.95fr]",
    size === "large" && "lg:grid"
  );

  if (project.href) {
    return (
      <Link href={project.href} className={className}>
        {size === "large" ? (
          <>
            {copy}
            {visual}
          </>
        ) : (
          <>
            {visual}
            {copy}
          </>
        )}
      </Link>
    );
  }

  return (
    <article className={className}>
      {size === "large" ? (
        <>
          {copy}
          {visual}
        </>
      ) : (
        <>
          {visual}
          {copy}
        </>
      )}
    </article>
  );
}

export function Projects() {
  const [featured, second, third, last] = PROJECTS;

  return (
    <section id="work" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={fadeUp}
        >
          <p className="pf-kicker">Work</p>
          <h2 className="pf-title mt-4 max-w-xl">Selected projects.</h2>
        </motion.div>

        <div className="mt-14 grid gap-5">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={scaleIn}
          >
            <ProjectPanel project={featured} size="large" />
          </motion.div>
          <div className="grid gap-5 lg:grid-cols-2">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <ProjectPanel project={second} size="small" />
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
            >
              <ProjectPanel project={third} size="small" />
            </motion.div>
          </div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={scaleIn}
          >
            <ProjectPanel project={last} size="large" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
