import { describe, expect, it } from "vitest";

import { assertAdminRole, isAdminRole } from "@/lib/admin/roles";
import { isSafeAppPath } from "@/lib/marketplace/schemas";

describe("admin access control", () => {
  it("treats only ADMIN as admin role", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("USER")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole("admin")).toBe(false);
  });

  it("rejects non-admin roles with Forbidden", () => {
    expect(() => assertAdminRole("USER")).toThrow("Forbidden");
    expect(() => assertAdminRole("ADMIN")).not.toThrow();
  });

  it("allows /admin callback paths for signed-in redirects", () => {
    expect(isSafeAppPath("/admin")).toBe(true);
    expect(isSafeAppPath("/admin/businesses")).toBe(true);
  });
});

/**
 * Mirrors requireAdminAction / getAdminUserOrNull gate used by /admin routes
 * and server actions — non-admins must be rejected server-side.
 */
describe("admin route gate (non-admin rejection)", () => {
  function gateAdminAccess(role: string | null | undefined) {
    if (!isAdminRole(role)) {
      return { ok: false as const, status: 403 as const, reason: "Forbidden" };
    }
    return { ok: true as const, status: 200 as const };
  }

  it("rejects a normal USER from /admin", () => {
    const result = gateAdminAccess("USER");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("allows ADMIN through /admin", () => {
    const result = gateAdminAccess("ADMIN");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});
