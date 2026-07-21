import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-void",
  {
    variants: {
      variant: {
        primary:
          "bg-violet text-white shadow-sm hover:brightness-105 active:scale-[0.98] active:brightness-95",
        secondary:
          "bg-panel-raised text-ink border border-border-strong shadow-sm hover:border-violet-soft hover:bg-charcoal active:scale-[0.98]",
        outline:
          "border border-border text-ink-dim hover:text-ink hover:border-violet-soft bg-transparent",
        ghost: "text-ink-dim hover:text-ink hover:bg-white/5",
        danger:
          "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
        link: "text-lilac underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  href?: any;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { className, variant, size, loading, disabled, children, href, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
