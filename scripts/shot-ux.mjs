import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "tmp-ux-shots");
fs.mkdirSync(out, { recursive: true });

const pages = [
  { name: "directory", url: "https://aftionix.tech/directory" },
  { name: "home-signin-redirect", url: "https://aftionix.tech/home" },
];

const browser = await chromium.launch();

for (const p of pages) {
  for (const [label, size] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport: size });
    await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({
      path: path.join(out, `${p.name}-${label}.png`),
      fullPage: true,
    });
    await page.close();
    console.log("shot", p.name, label);
  }
}

await browser.close();
console.log("wrote", out);
