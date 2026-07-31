import { auth } from "@/auth";
import { NextResponse } from "next/server";

import { isSafeAppPath } from "@/lib/marketplace/schemas";

const PROTECTED = [
  "/dashboard",
  "/stories",
  "/connect",
  "/settings",
  "/create",
];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const needsAuth = PROTECTED.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
  if (!needsAuth || req.auth?.user?.id) {
    return NextResponse.next();
  }

  const dest = `${path}${req.nextUrl.search}`;
  const url = new URL("/sign-in", req.nextUrl.origin);
  if (isSafeAppPath(dest)) {
    url.searchParams.set("callbackUrl", dest);
  }
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/stories",
    "/stories/:path*",
    "/connect",
    "/connect/:path*",
    "/settings",
    "/settings/:path*",
    "/create",
    "/create/:path*",
  ],
};
