import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** HTML tags that accept children — avoid `ElementType`, which can collapse to `never` under R3F JSX types. */
type ContainerTag =
  | "div"
  | "section"
  | "article"
  | "main"
  | "header"
  | "footer"
  | "nav";

export function Container({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: ContainerTag;
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-7xl px-6 lg:px-10", className)}>
      {children}
    </Tag>
  );
}
