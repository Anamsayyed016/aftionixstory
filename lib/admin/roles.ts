/** Pure helpers — safe to unit-test without Next/Prisma. */

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

export function assertAdminRole(role: string | null | undefined): void {
  if (!isAdminRole(role)) {
    throw new Error("Forbidden");
  }
}
