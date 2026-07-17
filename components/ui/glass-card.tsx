import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  manuscript?: boolean;
  hover?: boolean;
}

function GlassCard({
  className,
  manuscript,
  hover,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-panel",
        manuscript && "sv-manuscript",
        hover &&
          "transition-all duration-300 hover:border-violet-soft/40 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(124,92,255,0.35)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { GlassCard };
