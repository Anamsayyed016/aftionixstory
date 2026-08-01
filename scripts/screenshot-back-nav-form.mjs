import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/sign-in`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(400);
await page.fill('input[name="email"]', "demo-business@aftionix.example");
await page.fill('input[name="password"]', "demo-pass-123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);

await page.goto(`${base}/connect/business`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(900);
await page.screenshot({
  path: path.join(outDir, "back-nav-form.png"),
  fullPage: false,
});
console.log("ok back-nav-form.png", page.url());

await browser.close();
