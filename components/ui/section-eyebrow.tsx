import * as React from "react";
import { cn } from "@/lib/utils";

function SectionEyebrow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-violet-soft",
        className
      )}
      {...props}
    >
      <span className="h-px w-6 bg-gradient-to-r from-violet to-transparent" />
      {children}
    </span>
  );
}

export { SectionEyebrow };
