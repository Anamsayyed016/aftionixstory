import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    plan?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: string;
    role?: string;
    /** ms epoch — last DB refresh of role/plan */
    roleRefreshedAt?: number;
  }
}
