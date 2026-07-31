import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
fs.mkdirSync(outDir, { recursive: true });

async function shot(url, name) {
  await page.goto("http://127.0.0.1:3000" + url, {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log("ok", name);
}

await shot("/b/bright-print-co", "marketplace-business-profile.png");
await shot("/f/maya-designer", "marketplace-freelancer-profile.png");
await shot("/dev/marketplace-preview", "marketplace-connect-flow.png");

await page.locator('[data-testid="preview-match-accepted"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(outDir, "marketplace-contact-reveal.png"),
  fullPage: false,
});
console.log("ok marketplace-contact-reveal.png");

await page.locator('[data-testid="preview-match-pending"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(outDir, "marketplace-express-interest-pending.png"),
  fullPage: false,
});
console.log("ok marketplace-express-interest-pending.png");

await page.locator('[data-testid="preview-gig-card"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(outDir, "marketplace-gig-posted.png"),
  fullPage: false,
});
console.log("ok marketplace-gig-posted.png");

await browser.close();
