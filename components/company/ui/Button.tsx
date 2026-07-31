import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const base =
  "group relative inline-flex items-center justify-center gap-2 font-medium tracking-tight " +
  "transition-all duration-300 ease-out focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "text-white shadow-[var(--shadow-glow-primary)] bg-[linear-gradient(135deg,var(--co-primary)_0%,var(--co-accent)_100%)] hover:brightness-[1.08] hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "text-ink bg-white border border-[var(--color-border-strong)] shadow-[var(--shadow-soft)] hover:border-primary/40 hover:-translate-y-0.5 active:translate-y-0",
  ghost:
    "text-ink-soft hover:text-ink bg-transparent",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-[0.9rem] rounded-[var(--radius-md)]",
  lg: "h-[3.25rem] px-7 text-[0.95rem] rounded-[var(--radius-lg)]",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "href"> & { href: string };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const {
    variant = "primary",
    size = "md",
    icon: Icon,
    iconPosition = "right",
    className,
    children,
    ...rest
  } = props;

  const classes = cn(base, variants[variant], sizes[size], className);

  const content = (
    <>
      {Icon && iconPosition === "left" && (
        <Icon className="size-4 shrink-0 transition-transform duration-300 group-hover:-translate-x-0.5" />
      )}
      <span>{children}</span>
      {Icon && iconPosition === "right" && (
        <Icon className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </>
  );

  if ("href" in props && props.href) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { href: _href, ...linkRest } = rest as React.ComponentProps<typeof Link>;
    return (
      <Link href={props.href} className={classes} {...linkRest}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
