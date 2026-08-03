import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

/**
 * Auth architecture (Phase A):
 * - PrismaAdapter persists User / Account (and Session/VerificationToken tables)
 * - session.strategy = "jwt" because Credentials provider cannot use database sessions
 * - JWT carries user id + plan for ownership-ready server checks
 * - Google OAuth uses the adapter to create/link accounts
 *
 * Do not switch to database sessions while Credentials login is enabled.
 *
 * JWT role/plan refresh lives here (Node only), not in auth.config — proxy.ts
 * shares that file and must stay edge-safe / Prisma-free.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan ?? "FREE";
        token.role = user.role ?? "USER";
      }

      const userId = (token.id as string | undefined) ?? undefined;
      if (!userId) return token;

      const lastRefresh = (token.roleRefreshedAt as number | undefined) ?? 0;
      const needsRefresh =
        Boolean(user) ||
        trigger === "update" ||
        Date.now() - lastRefresh > 60_000;

      if (needsRefresh) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true, plan: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.plan = dbUser.plan;
        }
        token.roleRefreshedAt = Date.now();
      }

      return token;
    },
  },
});
