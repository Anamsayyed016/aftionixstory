"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  Settings,
  PenLine,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stories", label: "My Stories", icon: Library },
  { href: "/stories/new", label: "Create Story", icon: PenLine },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({
  userName,
  userEmail,
  plan,
}: {
  userName: string;
  userEmail: string;
  plan: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-charcoal/80 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-violet to-lilac text-white">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-semibold text-ink">
            {SITE.name}
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/stories"
              ? pathname === "/stories" ||
                (pathname.startsWith("/stories/") &&
                  !pathname.startsWith("/stories/new"))
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-panel-raised text-ink"
                  : "text-ink-dim hover:bg-white/5 hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="mt-4 rounded-md border border-border/80 bg-panel/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Coming later
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-dim">
            Memories and AI episode generation are not available yet (Phase C/D).
            Open a story to manage its characters.
          </p>
        </div>
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-medium text-ink">{userName}</p>
          <p className="truncate font-mono text-xs text-ink-faint">
            {userEmail}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-violet-soft">
            Plan · {plan}
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </form>
      </div>
    </aside>
  );
}
