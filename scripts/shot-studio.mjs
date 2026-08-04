import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "tmp-studio-shots");
fs.mkdirSync(out, { recursive: true });
const url = process.env.SHOT_URL || "https://aftionix.tech/studio";

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({
  path: path.join(out, "studio-desktop.png"),
  fullPage: true,
});

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({
  path: path.join(out, "studio-mobile.png"),
  fullPage: true,
});

await browser.close();
console.log("wrote", out, "from", url);
