import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminRole } from "@/lib/admin/roles";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  plan: string;
};

/**
 * DB-backed admin check — never trust JWT alone for mutations.
 * Returns null when the caller is not an admin (or not signed in).
 */
export async function getAdminUserOrNull(
  userId?: string | null
): Promise<AdminUser | null> {
  const id =
    userId ??
    (await auth())?.user?.id ??
    null;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
    },
  });
  if (!user || !isAdminRole(user.role)) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
  };
}

/** Redirect non-admins away from /admin (server-side). */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/admin");
  }
  const admin = await getAdminUserOrNull(session.user.id);
  if (!admin) {
    redirect("/home");
  }
  return admin;
}

/** Throw for server actions — no silent UI hide. */
export async function requireAdminAction(): Promise<AdminUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const admin = await getAdminUserOrNull(session.user.id);
  if (!admin) {
    throw new Error("Forbidden");
  }
  return admin;
}
