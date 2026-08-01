import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const b = await p.business.findMany({
  take: 5,
  select: { slug: true, name: true },
});
const f = await p.freelancerProfile.findMany({
  take: 5,
  select: { slug: true },
});
console.log(JSON.stringify({ b, f }, null, 2));
await p.$disconnect();
