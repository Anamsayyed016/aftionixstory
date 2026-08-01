/**
 * Verify public /b/[slug] gate:
 * - matching contact email → verified → 200
 * - mismatched contact email → unverified → 404
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const prisma = new PrismaClient();
const stamp = Date.now().toString(36);

fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const passwordHash = await bcrypt.hash("e2e-pass", 10);
  const email = `e2e-verified-${stamp}@aftionix.example`;

  const user = await prisma.user.create({
    data: {
      email,
      name: "E2E Verified Owner",
      passwordHash,
    },
  });

  const verifiedSlug = `e2e-verified-${stamp}`;
  const unverifiedSlug = `e2e-unverified-${stamp}`;

  await prisma.business.create({
    data: {
      ownerUserId: user.id,
      slug: verifiedSlug,
      name: `Verified Shop ${stamp}`,
      summary: "Verified public listing",
      category: "Services",
      location: "Pune",
      contactEmail: email,
      contactPhone: "+91 91111 11111",
      verifiedAt: new Date(),
    },
  });

  // Second user so we don't collide with one-business-per-owner helper assumptions
  const user2 = await prisma.user.create({
    data: {
      email: `e2e-unverified-${stamp}@aftionix.example`,
      name: "E2E Unverified Owner",
      passwordHash,
    },
  });

  await prisma.business.create({
    data: {
      ownerUserId: user2.id,
      slug: unverifiedSlug,
      name: `Hidden Shop ${stamp}`,
      summary: "Should 404 publicly",
      category: "Services",
      location: "Pune",
      contactEmail: "different@example.com",
      verifiedAt: null,
    },
  });

  const verifiedRes = await fetch(`${base}/b/${verifiedSlug}`);
  const unverifiedRes = await fetch(`${base}/b/${unverifiedSlug}`);
  const demoRes = await fetch(`${base}/b/bright-print-co`);

  console.log(
    JSON.stringify(
      {
        verified: { path: `/b/${verifiedSlug}`, status: verifiedRes.status },
        unverified: {
          path: `/b/${unverifiedSlug}`,
          status: unverifiedRes.status,
        },
        demo: { path: "/b/bright-print-co", status: demoRes.status },
      },
      null,
      2
    )
  );

  if (verifiedRes.status !== 200) {
    throw new Error(`verified listing expected 200, got ${verifiedRes.status}`);
  }
  if (unverifiedRes.status !== 404) {
    throw new Error(
      `unverified listing expected 404, got ${unverifiedRes.status}`
    );
  }
  if (demoRes.status !== 200) {
    throw new Error(`demo bright-print-co expected 200, got ${demoRes.status}`);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/b/${verifiedSlug}`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "business-verified-public.png"),
  });
  await page.goto(`${base}/b/bright-print-co`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(outDir, "business-demo-bright-print-co.png"),
  });
  await browser.close();
  console.log("ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
