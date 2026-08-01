/**
 * Promote a user to ADMIN by email.
 *
 * Usage:
 *   node --env-file=.env scripts/promote-admin.mjs you@example.com
 *
 * Or SQL:
 *   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
 *
 * Sign out and back in after promoting so the session picks up the role
 * (admin pages also re-check the DB on every request).
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node --env-file=.env scripts/promote-admin.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }
  const updated = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });
  console.log("Promoted:", updated);
  console.log("Open /admin after signing in.");
} finally {
  await prisma.$disconnect();
}
