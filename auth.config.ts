import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

import { loginSchema } from "@/lib/validations/auth";

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { prisma } = await import("@/lib/db");
        const { verifyPassword } = await import("@/lib/auth/password");

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          plan: user.plan,
        };
      },
    }),
  ];

  const googleId =
    process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "";
  const googleSecret =
    process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "";

  if (googleId && googleSecret) {
    providers.unshift(
      Google({
        clientId: googleId,
        clientSecret: googleSecret,
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  return providers;
}

/**
 * Auth.js config shared by proxy and the full auth instance.
 * Session strategy: JWT (required for Credentials; adapter still stores users/accounts).
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: buildProviders(),
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/stories") ||
        pathname.startsWith("/settings");

      if (isProtected) {
        return !!auth?.user;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.plan = user.plan ?? "FREE";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.plan = (token.plan as string) ?? "FREE";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

/** Lightweight auth helper for proxy (no Prisma adapter). */
export const { auth: proxyAuth } = NextAuth(authConfig);
