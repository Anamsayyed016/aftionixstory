import { NextResponse } from "next/server";

import { proxyAuth } from "@/auth.config";
import { isSafeAppPath } from "@/lib/marketplace/schemas";

/**
 * Next.js 16 `proxy.ts` (replaces deprecated `middleware.ts`).
 * Named export `proxy` per Next.js 16 file convention.
 * Uses Auth.js without PrismaAdapter (JWT cookie inspection only).
 *
 * Do NOT add middleware.ts — Next.js 16 errors if both files exist.
 */
export const proxy = proxyAuth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/stories") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/connect") ||
    pathname.startsWith("/create") ||
    pathname.startsWith("/admin");

  if (isProtected && !isLoggedIn) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    const dest = `${pathname}${search}`;
    if (isSafeAppPath(dest)) {
      signInUrl.searchParams.set("callbackUrl", dest);
    } else {
      signInUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  const isAuthPage =
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password";

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/stories/:path*",
    "/settings/:path*",
    "/connect/:path*",
    "/create/:path*",
    "/admin",
    "/admin/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
  ],
};
