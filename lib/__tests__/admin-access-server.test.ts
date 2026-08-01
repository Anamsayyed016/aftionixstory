import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

describe("getAdminUserOrNull (server gate)", () => {
  beforeEach(() => {
    findUnique.mockReset();
    authMock.mockReset();
  });

  it("returns null for a non-admin user (rejects /admin)", async () => {
    const { getAdminUserOrNull } = await import("@/lib/admin/access");
    findUnique.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      name: "User",
      role: "USER",
      plan: "FREE",
    });

    const result = await getAdminUserOrNull("u1");
    expect(result).toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
      },
    });
  });

  it("returns the user when role is ADMIN", async () => {
    const { getAdminUserOrNull } = await import("@/lib/admin/access");
    findUnique.mockResolvedValue({
      id: "a1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      plan: "STUDIO",
    });

    const result = await getAdminUserOrNull("a1");
    expect(result).toEqual({
      id: "a1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      plan: "STUDIO",
    });
  });

  it("requireAdminAction throws Forbidden for non-admin", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue({
      id: "u1",
      email: "user@example.com",
      name: null,
      role: "USER",
      plan: "FREE",
    });

    const { requireAdminAction } = await import("@/lib/admin/access");
    await expect(requireAdminAction()).rejects.toThrow("Forbidden");
  });
});
