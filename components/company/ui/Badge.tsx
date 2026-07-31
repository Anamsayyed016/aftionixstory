import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function Badge({
  children,
  icon: Icon,
  variant = "soft",
  className,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: "soft" | "outline" | "mono";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-wide",
        variant === "soft" &&
          "bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.08))] text-primary-dim",
        variant === "outline" && "border border-border-strong text-ink-soft",
        variant === "mono" && "font-mono bg-canvas-soft text-ink-soft border border-border",
        className
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  );
}
