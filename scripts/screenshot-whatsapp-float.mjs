import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "tmp-screenshots");
const base = process.env.BASE_URL || "http://127.0.0.1:3000";
fs.mkdirSync(outDir, { recursive: true });

async function shot(viewport, url, name) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  await page.goto(base + url, { waitUntil: "load", timeout: 90000 });
  // Wait for delayed FAB entrance (~0.55s delay + 0.55s anim)
  await page.waitForTimeout(1800);

  const fab = page.getByRole("link", { name: "Chat on WhatsApp" });
  await fab.waitFor({ state: "visible", timeout: 10000 });
  const box = await fab.boundingBox();
  const href = await fab.getAttribute("href");
  const header = page.locator("header").first();
  const headerBox = await header.boundingBox();

  const overlapsHeader =
    box &&
    headerBox &&
    !(
      box.y + box.height < headerBox.y ||
      box.y > headerBox.y + headerBox.height ||
      box.x + box.width < headerBox.x ||
      box.x > headerBox.x + headerBox.width
    );

  console.log(name, {
    href,
    fab: box && { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
    overlapsHeader: !!overlapsHeader,
    viewport,
  });

  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  await browser.close();
}

await shot({ width: 1440, height: 900 }, "/", "whatsapp-float-home-desktop.png");
await shot({ width: 390, height: 844 }, "/", "whatsapp-float-home-mobile.png");
await shot({ width: 1440, height: 900 }, "/contact", "whatsapp-float-contact-desktop.png");
await shot({ width: 390, height: 844 }, "/contact", "whatsapp-float-contact-mobile.png");
console.log("done");
