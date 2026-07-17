import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel/40 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet/15 text-violet-soft">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-5 font-display text-xl font-semibold text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {description}
      </p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-6">
          <Button>{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}
