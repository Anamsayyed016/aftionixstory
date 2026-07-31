import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
fs.mkdirSync(outDir, { recursive: true });

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();

async function shot(viewport, url, name, scrollTo) {
  const page = await browser.newPage({ viewport });
  await page.goto(base + url, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(1200);
  if (scrollTo) {
    await page.locator(scrollTo).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log("ok", name);
  await page.close();
}

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

await shot(desktop, "/", "portfolio-home-desktop.png");
await shot(mobile, "/", "portfolio-home-mobile.png");
await shot(desktop, "/", "portfolio-services-desktop.png", "#services");
await shot(mobile, "/", "portfolio-services-mobile.png", "#services");
await shot(desktop, "/", "portfolio-process-desktop.png", "#process");
await shot(mobile, "/", "portfolio-process-mobile.png", "#process");

await browser.close();
console.log("done →", outDir);
