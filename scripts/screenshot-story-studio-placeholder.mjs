/**
 * Screenshots: Story Studio rebuild placeholder (desktop + mobile).
 * Also hits /dashboard and /stories (expect sign-in without session).
 * Run: node scripts/screenshot-story-studio-placeholder.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://localhost:3000";

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const shotPath = path.join(outDir, name);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("wrote", shotPath);
  return shotPath;
}

async function main() {
  const browser = await chromium.launch();
  const preview = `${base}/dev/story-studio-placeholder-preview`;

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desktop.goto(preview, { waitUntil: "domcontentloaded", timeout: 60000 });
  await desktop.waitForSelector("text=Story Studio is being rebuilt", {
    timeout: 60000,
  });
  await shot(desktop, "story-studio-placeholder-desktop.png");

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await mobile.goto(preview, { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobile.waitForSelector("text=Story Studio is being rebuilt", {
    timeout: 60000,
  });
  await shot(mobile, "story-studio-placeholder-mobile.png");

  // Authenticated routes redirect to sign-in without a session — confirm no crash.
  for (const route of ["/dashboard", "/stories"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const res = await page.goto(`${base}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1500);
    const url = page.url();
    const status = res?.status() ?? 0;
    console.log(route, "→", status, url);
    await shot(page, `route-${route.replace(/\//g, "_") || "root"}.png`);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
