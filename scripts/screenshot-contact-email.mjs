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
await page.goto(base + "/contact", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(800);

const emailBtn = page.getByRole("link", { name: /Email anamsayyed58@gmail\.com/i });
await emailBtn.waitFor({ state: "visible", timeout: 10000 });
const href = await emailBtn.getAttribute("href");
console.log({ href, text: await emailBtn.innerText() });

await page.screenshot({
  path: path.join(outDir, "contact-email-updated.png"),
  fullPage: false,
});
await browser.close();
console.log("done");
