import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Ownership-ready session helpers for Phase B+.
 * Always derive identity from the server session — never from the client.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    plan: session.user.plan ?? "FREE",
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}
