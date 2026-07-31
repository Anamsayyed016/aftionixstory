import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(base + "/", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(800);

const footer = page.locator("footer");
await footer.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

const socials = footer.locator('a[aria-label]');
const count = await socials.count();
const hrefs = [];
for (let i = 0; i < count; i++) {
  hrefs.push({
    label: await socials.nth(i).getAttribute("aria-label"),
    href: await socials.nth(i).getAttribute("href"),
  });
}
console.log("socials", hrefs);

await footer.screenshot({ path: path.join(outDir, "footer-socials.png") });

// Hover WhatsApp for polish verification
const wa = footer.locator('a[aria-label="WhatsApp"]');
await wa.hover();
await page.waitForTimeout(350);
await footer.screenshot({ path: path.join(outDir, "footer-socials-whatsapp-hover.png") });

await browser.close();
console.log("done");
