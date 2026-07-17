import "server-only";

import { getEnv, isGoogleOAuthConfigured } from "@/lib/env";

/**
 * Central server config derived from validated environment.
 * Import only from server components, route handlers, and server actions.
 */
export function getServerConfig() {
  const env = getEnv();

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    auth: {
      secret: env.AUTH_SECRET,
      url: env.AUTH_URL,
      google: {
        enabled: isGoogleOAuthConfigured(),
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    databaseUrl: env.DATABASE_URL,
    plans: {
      FREE: {
        generationLimit: 20,
        label: "Free",
      },
      WRITER: {
        generationLimit: 200,
        label: "Writer",
      },
      STUDIO: {
        generationLimit: 1000,
        label: "Studio",
      },
    },
  } as const;
}

export type ServerConfig = ReturnType<typeof getServerConfig>;
