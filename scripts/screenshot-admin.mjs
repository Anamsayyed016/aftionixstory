import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${base}/sign-in`, { waitUntil: "load", timeout: 60000 });
await page.fill('input[name="email"]', "demo-business@aftionix.example");
await page.fill('input[name="password"]', "demo-pass-123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.goto(`${base}/admin`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({
  path: path.join(outDir, "admin-overview.png"),
  fullPage: false,
});
console.log("ok admin-overview.png", page.url());

await page.goto(`${base}/admin/businesses`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({
  path: path.join(outDir, "admin-businesses.png"),
  fullPage: false,
});
console.log("ok admin-businesses.png", page.url());

await browser.close();
