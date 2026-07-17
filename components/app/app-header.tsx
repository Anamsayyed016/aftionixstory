"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, LayoutDashboard, Library, Settings } from "lucide-react";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stories", label: "My Stories", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function titleForPath(pathname: string) {
  if (pathname.startsWith("/stories")) return "My Stories";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  return "Workspace";
}

export function AppHeader({ userName }: { userName: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-void/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint md:hidden">
              {SITE.name}
            </p>
            <h1 className="font-display text-lg font-semibold tracking-tight text-ink">
              {title}
            </h1>
          </div>
        </div>
        <p className="hidden text-sm text-ink-dim sm:block">{userName}</p>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              <Link
                href="/"
                className="mb-2 flex items-center gap-2 px-3 py-2 text-sm text-ink-dim"
                onClick={() => setOpen(false)}
              >
                <BookOpen className="h-4 w-4" />
                Marketing site
              </Link>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active
                        ? "bg-panel-raised text-ink"
                        : "text-ink-dim hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <form action={logoutAction} className="mt-2">
                <Button type="submit" variant="secondary" className="w-full">
                  Log out
                </Button>
              </form>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
