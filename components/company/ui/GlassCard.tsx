import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  hoverLift = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass-panel rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]",
        hoverLift &&
          "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-lifted)]",
        className
      )}
    >
      {children}
    </div>
  );
}
