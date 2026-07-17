import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-tight",
  {
    variants: {
      variant: {
        default: "bg-white/5 text-ink-dim border border-border",
        violet: "bg-violet/12 text-violet-soft border border-violet/25",
        rose: "bg-rose/10 text-rose border border-rose/25",
        success: "bg-success/10 text-success border border-success/25",
        warning: "bg-warning/10 text-warning border border-warning/25",
        danger: "bg-danger/10 text-danger border border-danger/25",
        outline: "border border-border-strong text-ink-faint",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "violet" && "bg-violet-soft",
            variant === "rose" && "bg-rose",
            (!variant || variant === "default" || variant === "outline") &&
              "bg-ink-faint"
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
