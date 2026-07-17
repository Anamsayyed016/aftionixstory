import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SITE } from "@/lib/constants";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-void">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 40% at 20% 0%, rgba(124,92,255,0.14), transparent 55%), radial-gradient(40% 35% at 90% 10%, rgba(232,180,200,0.08), transparent 50%)",
        }}
      />

      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-violet to-lilac text-white">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              {SITE.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 text-sm text-ink-dim">{subtitle}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel/80 p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
