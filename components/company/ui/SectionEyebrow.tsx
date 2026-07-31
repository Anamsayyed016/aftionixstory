import { cn } from "@/lib/utils";

/**
 * Small mono-font label used above section headings — e.g. "( SERVICES )".
 * Encodes section identity without resorting to generic numbered markers.
 */
export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-xs font-medium tracking-[0.2em] text-primary-dim uppercase",
        className
      )}
    >
      {"// "}
      {children}
    </span>
  );
}
