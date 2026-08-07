import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://localhost:3001";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/studio`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Story Studio", { timeout: 120000 });
  // Confirm pricing headline is gone
  const pricing = await page.locator("text=Start free. Write as much as the story needs.").count();
  const freeCard = await page.locator("text=/^Free$/").count();
  console.log("pricing_headline_count", pricing);
  console.log("has_Writer_plan_label", await page.locator("text=Writer").count());
  await page.screenshot({
    path: path.join(outDir, "studio-no-pricing-desktop.png"),
    fullPage: true,
  });
  console.log("wrote studio-no-pricing-desktop.png");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(`${base}/studio`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mobile.waitForSelector("text=Story Studio", { timeout: 120000 });
  await mobile.screenshot({
    path: path.join(outDir, "studio-no-pricing-mobile.png"),
    fullPage: true,
  });
  console.log("wrote studio-no-pricing-mobile.png");
  await browser.close();
  if (pricing > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
