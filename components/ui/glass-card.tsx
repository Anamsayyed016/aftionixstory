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
        "rounded-xl border border-border bg-panel shadow-[var(--sv-shadow-sm)]",
        manuscript && "sv-manuscript",
        hover &&
          "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-violet-soft/50 hover:shadow-[var(--sv-shadow-md)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { GlassCard };
