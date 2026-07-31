import { cn } from "@/lib/utils";
import type { ElementType } from "react";

export function Container({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-7xl px-6 lg:px-10", className)}>
      {children}
    </Tag>
  );
}
