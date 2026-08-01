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

async function shot(url, name) {
  await page.goto(base + url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log("ok", name);
}

await shot("/b/bright-print-co", "back-nav-business.png");
await shot("/dev/marketplace-forms-preview", "back-nav-form-preview.png");

await browser.close();
