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
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  trustHost: true,
});
