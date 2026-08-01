import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getAdminUserOrNull } from "@/lib/admin/access";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppHeader } from "@/components/app/app-header";
import { MobileNavigation } from "@/components/app/mobile-navigation";
import { getUsageSnapshot } from "@/lib/usage/generation";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const userName = session.user.name || "Writer";
  const userEmail = session.user.email || "";
  const plan = session.user.plan || "FREE";
  // DB-backed — UI appears after promote without relying on a stale JWT alone.
  const isAdmin = Boolean(await getAdminUserOrNull(session.user.id));

  let usage: { used: number; limit: number } | undefined;
  try {
    const snap = await getUsageSnapshot(session.user.id);
    usage = { used: snap.used, limit: snap.limit };
  } catch {
    usage = undefined;
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-void text-ink">
      <AppSidebar
        userName={userName}
        userEmail={userEmail}
        plan={plan}
        isAdmin={isAdmin}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader userName={userName} usage={usage} isAdmin={isAdmin} />
        {/*
          Mobile: reserve bottom space for fixed tab bar (h-14) + safe area.
          Use flex fill (not 100dvh calcs) so chat + composer stay on-screen.
        */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pt-4 md:px-8 md:pb-8 md:pt-6">
          {children}
        </main>
        <MobileNavigation />
      </div>
    </div>
  );
}
