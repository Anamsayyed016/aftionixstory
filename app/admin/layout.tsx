import { requireAdmin } from "@/lib/admin/access";
import { AdminNav } from "@/components/admin/admin-nav";
import { BackLink } from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh bg-void text-ink">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-violet-soft">
                Internal
              </p>
              <h1 className="font-display text-xl font-semibold tracking-tight">
                AFTIONIX Admin
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="truncate text-ink-dim">{admin.email}</span>
              <BackLink href="/home">Back to app</BackLink>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
