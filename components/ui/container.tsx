import * as React from "react";
import { cn } from "@/lib/utils";

function Container({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-10", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Container };
