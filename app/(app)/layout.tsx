import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppHeader } from "@/components/app/app-header";
import { MobileNavigation } from "@/components/app/mobile-navigation";

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

  return (
    <div className="flex min-h-screen bg-void text-ink">
      <AppSidebar userName={userName} userEmail={userEmail} plan={plan} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader userName={userName} />
        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">{children}</main>
        <MobileNavigation />
      </div>
    </div>
  );
}
