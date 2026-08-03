/**
 * Promote a user to ADMIN by email.
 *
 * LOCAL:
 *   node --env-file=.env scripts/promote-admin.mjs you@example.com
 *
 * PRODUCTION (VPS — uses the server's .env / Docker Postgres, not your laptop DB):
 *   ssh root@aftionix.tech
 *   cd /var/www/storyverse-ai
 *   docker compose exec -T db psql -U storyverse -d storyverse \
 *     -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'you@example.com' RETURNING id, email, role;"
 *
 * Or from the VPS app dir with Node (same DATABASE_URL as Docker):
 *   node --env-file=.env scripts/promote-admin.mjs you@example.com
 *
 * Sidebar "Admin Dashboard" is DB-backed — a normal page refresh after
 * promote is enough. JWT role claim also refreshes within ~60s via auth.ts.
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
  console.log("Refresh /dashboard (or sign out/in) — Admin Dashboard should appear.");
} finally {
  await prisma.$disconnect();
}
